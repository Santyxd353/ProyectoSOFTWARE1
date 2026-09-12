import {
  AuditAction,
  ProjectType,
  RevisionStatus,
  Role,
} from '@prisma/client';
import { CodeRepositoryService } from './code-repository.service';

describe('CodeRepositoryService publication', () => {
  let revisionStatus: RevisionStatus | undefined;
  let revisionRows: any[];
  let artifactObjects: Map<string, Buffer>;
  let auditActions: AuditAction[];
  let failStorage: boolean;

  const revisionBase = {
    id: 'revision-1',
    workspaceId: 'workspace-1',
    diagramId: 'diagram-1',
    modelVersion: 4,
    authorId: 'user-1',
    projectType: ProjectType.SPRING_BOOT,
    generator: 'spring-ejs@1',
    parentRevisionId: null,
    restoredFromId: null,
    manifest: {},
    createdAt: new Date('2026-09-12T10:00:00Z'),
    publishedAt: null,
  };

  const prisma = {
    codeRevision: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    revisionFile: {
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const authorization = {
    require: jest.fn(),
  };

  const scanner = {
    scan: jest.fn(),
  };

  const storage = {
    put: jest.fn(),
    read: jest.fn(),
    exists: jest.fn(),
    delete: jest.fn(),
  };

  const audit = {
    record: jest.fn(),
  };

  let service: CodeRepositoryService;

  beforeEach(() => {
    jest.clearAllMocks();
    revisionStatus = undefined;
    revisionRows = [];
    artifactObjects = new Map();
    auditActions = [];
    failStorage = false;

    authorization.require.mockResolvedValue({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      role: Role.EDITOR,
      allowViewerComments: false,
    });
    prisma.codeRevision.findFirst.mockResolvedValue(null);
    prisma.codeRevision.create.mockImplementation(({ data }) => {
      revisionStatus = RevisionStatus.CREATING;
      return Promise.resolve({
        ...revisionBase,
        ...data,
        status: revisionStatus,
      });
    });
    prisma.revisionFile.createMany.mockImplementation(({ data }) => {
      revisionRows = data;
      return Promise.resolve({ count: data.length });
    });
    prisma.codeRevision.update.mockImplementation(({ data }) => {
      revisionStatus = data.status;
      return Promise.resolve({
        ...revisionBase,
        ...data,
        status: revisionStatus,
        _count: { files: revisionRows.length, comments: 0 },
      });
    });
    prisma.$transaction.mockImplementation((operation) => operation(prisma));
    scanner.scan.mockResolvedValue([
      {
        path: 'src/App.ts',
        bytes: Buffer.from('export const app = true;'),
        checksum: 'a'.repeat(64),
        size: 24,
        mimeType: 'text/typescript',
        isBinary: false,
      },
    ]);
    storage.put.mockImplementation(async (key, bytes) => {
      if (failStorage) throw new Error('disk full');
      artifactObjects.set(key, bytes);
    });
    storage.delete.mockImplementation(async (key) => {
      artifactObjects.delete(key);
    });
    audit.record.mockImplementation(async ({ action }) => {
      auditActions.push(action);
    });

    service = new CodeRepositoryService(
      prisma as any,
      authorization as any,
      audit as any,
      scanner as any,
      storage as any,
    );
  });

  const input = {
    workspaceId: 'workspace-1',
    diagramId: 'diagram-1',
    modelVersion: 4,
    authorId: 'user-1',
    projectType: ProjectType.SPRING_BOOT,
    generator: 'spring-ejs@1',
    rootPath: 'C:/generated/project',
  };

  it('publishes one immutable revision containing every scanned file', async () => {
    const result = await service.publishGeneratedProject(input);

    expect(result).toEqual({
      id: 'revision-1',
      workspaceId: 'workspace-1',
      diagramId: 'diagram-1',
      modelVersion: 4,
      authorId: 'user-1',
      projectType: ProjectType.SPRING_BOOT,
      generator: 'spring-ejs@1',
      status: RevisionStatus.PUBLISHED,
      parentRevisionId: null,
      restoredFromId: null,
      manifest: { fileCount: 1, totalBytes: 24 },
      createdAt: new Date('2026-09-12T10:00:00Z'),
      publishedAt: expect.any(Date),
      fileCount: 1,
      commentCount: 0,
    });
    expect(revisionStatus).toBe(RevisionStatus.PUBLISHED);
    expect(revisionRows).toHaveLength(1);
    expect(revisionRows[0]).toMatchObject({
      revisionId: 'revision-1',
      path: 'src/App.ts',
      storageKey: `workspace-1/revision-1/${'a'.repeat(64)}`,
    });
    expect(artifactObjects.size).toBe(1);
    expect(auditActions).toEqual([AuditAction.REVISION_PUBLISHED]);
  });

  it('marks a revision failed and cleans stored objects after storage failure', async () => {
    failStorage = true;

    await expect(service.publishGeneratedProject(input)).rejects.toThrow(
      'disk full',
    );

    expect(revisionStatus).toBe(RevisionStatus.FAILED);
    expect(artifactObjects.size).toBe(0);
    expect(auditActions).toEqual([
      AuditAction.REVISION_PUBLICATION_FAILED,
    ]);
  });
});
