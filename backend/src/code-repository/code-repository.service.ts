import { Inject, Injectable } from '@nestjs/common';
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
  PublishGeneratedProjectInput,
  RevisionSummaryDto,
} from './code-repository.types';

@Injectable()
export class CodeRepositoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
    private readonly scanner: ProjectFileScanner,
    @Inject(ARTIFACT_STORAGE)
    private readonly storage: ArtifactStorage,
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

  private toSummary(revision: any): RevisionSummaryDto {
    const { _count, ...data } = revision;
    return {
      ...data,
      fileCount: _count?.files ?? 0,
      commentCount: _count?.comments ?? 0,
    };
  }
}
