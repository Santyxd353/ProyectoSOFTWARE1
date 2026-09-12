import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  Prisma,
  RevisionStatus,
} from '@prisma/client';
import { ArtifactStorage, ARTIFACT_STORAGE } from '../artifact-storage/artifact-storage';
import { ProjectFileScanner } from '../artifact-storage/project-file-scanner';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateReviewCommentInput,
  PublishGeneratedProjectInput,
  RevisionComparisonDto,
  RevisionDownload,
  RevisionFileDto,
  RevisionSummaryDto,
} from './code-repository.types';
import { createReadStream, createWriteStream } from 'fs';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import * as archiver from 'archiver';
import { RepositoryRealtimeService } from '../collaboration/repository-realtime.service';

@Injectable()
export class CodeRepositoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
    private readonly scanner: ProjectFileScanner,
    @Inject(ARTIFACT_STORAGE)
    private readonly storage: ArtifactStorage,
    private readonly config: ConfigService,
    private readonly realtime: RepositoryRealtimeService,
  ) {}

  async publishGeneratedProject(
    input: PublishGeneratedProjectInput,
  ): Promise<RevisionSummaryDto> {
    await this.authorization.require(
      input.workspaceId,
      input.authorId,
      'repository:generate',
    );

    let revisionId: string | undefined;
    const storedKeys: string[] = [];

    try {
      const parent = await this.prisma.codeRevision.findFirst({
        where: {
          workspaceId: input.workspaceId,
          diagramId: input.diagramId,
          status: RevisionStatus.PUBLISHED,
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      const revision = await this.prisma.codeRevision.create({
        data: {
          workspaceId: input.workspaceId,
          diagramId: input.diagramId,
          modelVersion: input.modelVersion,
          authorId: input.authorId,
          projectType: input.projectType,
          generator: input.generator,
          status: RevisionStatus.CREATING,
          parentRevisionId: parent?.id,
          manifest: {},
        },
      });
      revisionId = revision.id;

      const files = await this.scanner.scan(input.rootPath);
      const rows: Prisma.RevisionFileCreateManyInput[] = [];

      for (const file of files) {
        const storageKey = `${input.workspaceId}/${revision.id}/${file.checksum}`;
        await this.storage.put(storageKey, file.bytes);
        storedKeys.push(storageKey);
        rows.push({
          revisionId: revision.id,
          path: file.path,
          storageKey,
          checksum: file.checksum,
          size: file.size,
          mimeType: file.mimeType,
          isBinary: file.isBinary,
        });
      }

      const manifest: Prisma.InputJsonValue = {
        fileCount: files.length,
        totalBytes: files.reduce((total, file) => total + file.size, 0),
      };
      const publishedAt = new Date();
      const published = await this.prisma.$transaction(async (transaction) => {
        if (rows.length > 0) {
          await transaction.revisionFile.createMany({ data: rows });
        }
        return transaction.codeRevision.update({
          where: { id: revision.id },
          data: {
            status: RevisionStatus.PUBLISHED,
            manifest,
            publishedAt,
          },
          include: {
            _count: { select: { files: true, comments: true } },
          },
        });
      });

      await this.audit.record({
        workspaceId: input.workspaceId,
        actorId: input.authorId,
        action: AuditAction.REVISION_PUBLISHED,
        entityType: 'CodeRevision',
        entityId: revision.id,
        metadata: {
          diagramId: input.diagramId,
          projectType: input.projectType,
          fileCount: files.length,
        },
      });

      return this.toSummary(published);
    } catch (error) {
      await Promise.allSettled(storedKeys.map((key) => this.storage.delete(key)));

      if (revisionId) {
        await this.prisma.codeRevision.update({
          where: { id: revisionId },
          data: { status: RevisionStatus.FAILED },
        });
        await this.audit.record({
          workspaceId: input.workspaceId,
          actorId: input.authorId,
          action: AuditAction.REVISION_PUBLICATION_FAILED,
          entityType: 'CodeRevision',
          entityId: revisionId,
          metadata: {
            diagramId: input.diagramId,
            projectType: input.projectType,
          },
        });
      }

      throw error;
    }
  }

  async list(
    workspaceId: string,
    userId: string,
    diagramId?: string,
  ): Promise<RevisionSummaryDto[]> {
    await this.authorization.require(workspaceId, userId, 'repository:read');
    const revisions = await this.prisma.codeRevision.findMany({
      where: {
        workspaceId,
        status: RevisionStatus.PUBLISHED,
        ...(diagramId ? { diagramId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { files: true, comments: true } } },
    });
    return revisions.map((revision) => this.toSummary(revision));
  }

  async get(
    workspaceId: string,
    revisionId: string,
    userId: string,
  ): Promise<RevisionSummaryDto> {
    await this.authorization.require(workspaceId, userId, 'repository:read');
    const revision = await this.prisma.codeRevision.findFirst({
      where: {
        id: revisionId,
        workspaceId,
        status: RevisionStatus.PUBLISHED,
      },
      include: { _count: { select: { files: true, comments: true } } },
    });
    if (!revision) throw new NotFoundException('Revision not found');
    return this.toSummary(revision);
  }

  async tree(
    workspaceId: string,
    revisionId: string,
    userId: string,
  ): Promise<RevisionFileDto[]> {
    await this.get(workspaceId, revisionId, userId);
    const files = await this.prisma.revisionFile.findMany({
      where: { revisionId },
      orderBy: { path: 'asc' },
    });
    return files
      .map((file) => this.toFileDto(file))
      .sort((left, right) => left.path.localeCompare(right.path));
  }

  async readFile(
    workspaceId: string,
    revisionId: string,
    fileId: string,
    userId: string,
  ) {
    await this.authorization.require(workspaceId, userId, 'repository:read');
    const file = await this.prisma.revisionFile.findFirst({
      where: {
        id: fileId,
        revisionId,
        revision: {
          workspaceId,
          status: RevisionStatus.PUBLISHED,
        },
      },
    });
    if (!file) throw new NotFoundException('Revision file not found');

    const dto = this.toFileDto(file);
    if (file.isBinary) return dto;

    const maxBytes = this.config.get<number>(
      'REPOSITORY_TEXT_MAX_BYTES',
      1_000_000,
    );
    if (file.size > maxBytes) {
      throw new PayloadTooLargeException('Text file exceeds preview limit');
    }
    const bytes = await this.storage.read(file.storageKey);
    return { ...dto, content: bytes.toString('utf8') };
  }

  async compare(
    workspaceId: string,
    baseRevisionId: string,
    targetRevisionId: string,
    userId: string,
    fileId?: string,
  ): Promise<RevisionComparisonDto> {
    await this.authorization.require(workspaceId, userId, 'repository:read');
    const ids = [...new Set([baseRevisionId, targetRevisionId])];
    const revisions = await this.prisma.codeRevision.findMany({
      where: {
        id: { in: ids },
        workspaceId,
        status: RevisionStatus.PUBLISHED,
      },
      select: { id: true },
    });
    if (revisions.length !== ids.length) {
      throw new NotFoundException('Revision not found');
    }

    const [baseFiles, targetFiles] = await Promise.all([
      this.prisma.revisionFile.findMany({ where: { revisionId: baseRevisionId } }),
      this.prisma.revisionFile.findMany({ where: { revisionId: targetRevisionId } }),
    ]);
    const baseByPath = new Map(baseFiles.map((file) => [file.path, file]));
    const targetByPath = new Map(targetFiles.map((file) => [file.path, file]));
    let paths = [...new Set([...baseByPath.keys(), ...targetByPath.keys()])]
      .sort((left, right) => left.localeCompare(right));

    if (fileId) {
      const selected = [...baseFiles, ...targetFiles].find(
        (file) => file.id === fileId,
      );
      if (!selected) throw new NotFoundException('Revision file not found');
      paths = [selected.path];
    }

    const maxBytes = this.config.get<number>(
      'REPOSITORY_DIFF_MAX_BYTES',
      1_000_000,
    );
    const files = [];

    for (const filePath of paths) {
      const base = baseByPath.get(filePath);
      const target = targetByPath.get(filePath);
      const baseDto = base ? this.toDiffFileDto(base) : undefined;
      const targetDto = target ? this.toDiffFileDto(target) : undefined;

      if (!base) {
        files.push({ path: filePath, kind: 'ADDED' as const, target: targetDto });
      } else if (!target) {
        files.push({ path: filePath, kind: 'REMOVED' as const, base: baseDto });
      } else if (base.checksum === target.checksum) {
        files.push({
          path: filePath,
          kind: 'UNCHANGED' as const,
          base: baseDto,
          target: targetDto,
        });
      } else if (base.isBinary || target.isBinary) {
        files.push({
          path: filePath,
          kind: 'BINARY_MODIFIED' as const,
          base: baseDto,
          target: targetDto,
        });
      } else {
        if (base.size + target.size > maxBytes) {
          throw new PayloadTooLargeException('Text comparison exceeds limit');
        }
        const [baseBytes, targetBytes] = await Promise.all([
          this.storage.read(base.storageKey),
          this.storage.read(target.storageKey),
        ]);
        files.push({
          path: filePath,
          kind: 'MODIFIED' as const,
          base: baseDto,
          target: targetDto,
          patch: this.unifiedDiff(
            baseBytes.toString('utf8'),
            targetBytes.toString('utf8'),
            filePath,
          ),
        });
      }
    }

    await this.audit.record({
      workspaceId,
      actorId: userId,
      action: AuditAction.REVISION_COMPARED,
      entityType: 'CodeRevision',
      entityId: targetRevisionId,
      metadata: { baseRevisionId, changedFiles: files.length },
    });

    return { baseRevisionId, targetRevisionId, files };
  }

  async restore(
    workspaceId: string,
    revisionId: string,
    userId: string,
  ): Promise<RevisionSummaryDto> {
    await this.authorization.require(workspaceId, userId, 'repository:restore');
    const source = await this.prisma.codeRevision.findFirst({
      where: {
        id: revisionId,
        workspaceId,
        status: RevisionStatus.PUBLISHED,
      },
      include: { files: true },
    });
    if (!source) throw new NotFoundException('Revision not found');
    const parent = await this.prisma.codeRevision.findFirst({
      where: { workspaceId, status: RevisionStatus.PUBLISHED },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    const restored = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.codeRevision.create({
        data: {
          workspaceId,
          diagramId: source.diagramId,
          modelVersion: source.modelVersion,
          authorId: userId,
          projectType: source.projectType,
          generator: source.generator,
          status: RevisionStatus.CREATING,
          parentRevisionId: parent?.id,
          restoredFromId: source.id,
          manifest: source.manifest as Prisma.InputJsonValue,
        },
      });
      if (source.files.length > 0) {
        await transaction.revisionFile.createMany({
          data: source.files.map((file) => ({
            revisionId: created.id,
            path: file.path,
            storageKey: file.storageKey,
            checksum: file.checksum,
            size: file.size,
            mimeType: file.mimeType,
            isBinary: file.isBinary,
          })),
        });
      }
      return transaction.codeRevision.update({
        where: { id: created.id },
        data: { status: RevisionStatus.PUBLISHED, publishedAt: new Date() },
        include: { _count: { select: { files: true, comments: true } } },
      });
    });

    await this.audit.record({
      workspaceId,
      actorId: userId,
      action: AuditAction.REVISION_RESTORED,
      entityType: 'CodeRevision',
      entityId: restored.id,
      metadata: { restoredFromId: source.id },
    });
    return this.toSummary(restored);
  }

  async listComments(
    workspaceId: string,
    revisionId: string,
    userId: string,
    fileId?: string,
  ) {
    await this.authorization.require(workspaceId, userId, 'repository:read');
    return this.prisma.reviewComment.findMany({
      where: {
        revisionId,
        ...(fileId ? { fileId } : {}),
        revision: { workspaceId, status: RevisionStatus.PUBLISHED },
      },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, name: true, avatar: true } } },
    });
  }

  async createComment(
    workspaceId: string,
    revisionId: string,
    userId: string,
    input: CreateReviewCommentInput,
  ) {
    await this.authorization.require(workspaceId, userId, 'comment:create');
    const body = input.body.trim();
    if (!body || body.length > 4000) {
      throw new BadRequestException('Comment must contain 1 to 4000 characters');
    }
    if (input.line !== undefined && (!Number.isInteger(input.line) || input.line < 1)) {
      throw new BadRequestException('Comment line must be a positive integer');
    }
    const file = await this.prisma.revisionFile.findFirst({
      where: {
        id: input.fileId,
        revisionId,
        revision: { workspaceId, status: RevisionStatus.PUBLISHED },
      },
      select: { id: true },
    });
    if (!file) throw new NotFoundException('Revision file not found');

    const comment = await this.prisma.reviewComment.create({
      data: {
        revisionId,
        fileId: file.id,
        authorId: userId,
        line: input.line,
        body,
      },
      include: { author: { select: { id: true, name: true, avatar: true } } },
    });
    await this.audit.record({
      workspaceId,
      actorId: userId,
      action: AuditAction.REVIEW_COMMENT_CREATED,
      entityType: 'ReviewComment',
      entityId: comment.id,
      metadata: { revisionId, fileId: file.id, line: input.line },
    });
    this.realtime.emitReviewComment(workspaceId, revisionId, comment);
    return comment;
  }

  async download(
    workspaceId: string,
    revisionId: string,
    userId: string,
  ): Promise<RevisionDownload> {
    await this.authorization.require(workspaceId, userId, 'repository:read');
    const revision = await this.prisma.codeRevision.findFirst({
      where: { id: revisionId, workspaceId, status: RevisionStatus.PUBLISHED },
      include: { files: { orderBy: { path: 'asc' } } },
    });
    if (!revision) throw new NotFoundException('Revision not found');

    const temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'revision-download-'),
    );
    const zipPath = path.join(temporaryDirectory, `revision-${revision.id}.zip`);

    try {
      await new Promise<void>(async (resolve, reject) => {
        const output = createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });
        output.on('close', resolve);
        output.on('error', reject);
        archive.on('error', reject);
        archive.pipe(output);

        try {
          for (const file of revision.files) {
            this.assertSafeArchivePath(file.path);
            archive.append(await this.storage.read(file.storageKey), {
              name: file.path,
            });
          }
          await archive.finalize();
        } catch (error) {
          archive.abort();
          reject(error);
        }
      });
    } catch (error) {
      await rm(temporaryDirectory, { recursive: true, force: true });
      throw error;
    }

    await this.audit.record({
      workspaceId,
      actorId: userId,
      action: AuditAction.REVISION_DOWNLOADED,
      entityType: 'CodeRevision',
      entityId: revision.id,
      metadata: { fileCount: revision.files.length },
    });
    return {
      stream: createReadStream(zipPath),
      filename: `revision-${revision.id}.zip`,
      cleanup: () => rm(temporaryDirectory, { recursive: true, force: true }),
    };
  }

  private toFileDto(file: any): RevisionFileDto {
    return {
      id: file.id,
      revisionId: file.revisionId,
      path: file.path,
      checksum: file.checksum,
      size: file.size,
      mimeType: file.mimeType,
      isBinary: file.isBinary,
      createdAt: file.createdAt,
    };
  }

  private toDiffFileDto(file: any) {
    const { id, checksum, size, mimeType, isBinary } = file;
    return { id, checksum, size, mimeType, isBinary };
  }

  private unifiedDiff(base: string, target: string, filePath: string): string {
    const baseLines = base.replace(/\r\n/g, '\n').split('\n');
    const targetLines = target.replace(/\r\n/g, '\n').split('\n');
    let prefix = 0;
    while (
      prefix < baseLines.length &&
      prefix < targetLines.length &&
      baseLines[prefix] === targetLines[prefix]
    ) prefix += 1;

    let suffix = 0;
    while (
      suffix < baseLines.length - prefix &&
      suffix < targetLines.length - prefix &&
      baseLines[baseLines.length - 1 - suffix] ===
        targetLines[targetLines.length - 1 - suffix]
    ) suffix += 1;

    const lines = [
      `--- base/${filePath}`,
      `+++ target/${filePath}`,
      `@@ -1,${baseLines.length} +1,${targetLines.length} @@`,
      ...baseLines.slice(0, prefix).map((line) => ` ${line}`),
      ...baseLines
        .slice(prefix, baseLines.length - suffix)
        .map((line) => `-${line}`),
      ...targetLines
        .slice(prefix, targetLines.length - suffix)
        .map((line) => `+${line}`),
      ...baseLines.slice(baseLines.length - suffix).map((line) => ` ${line}`),
    ];
    return lines.join('\n');
  }

  private assertSafeArchivePath(filePath: string): void {
    if (
      !filePath ||
      filePath.includes('\\') ||
      path.posix.isAbsolute(filePath) ||
      filePath.split('/').some((segment) => !segment || segment === '..')
    ) {
      throw new UnprocessableEntityException('Unsafe revision file path');
    }
  }

  private toSummary(revision: any): RevisionSummaryDto {
    const { _count, ...data } = revision;
    return {
      ...data,
      fileCount: _count?.files ?? 0,
      commentCount: _count?.comments ?? 0,
    };
  }
}
