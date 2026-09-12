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
      { get: (_key: string, fallback: unknown) => fallback } as any,
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

describe('CodeRepositoryService review workflows', () => {
  const prisma = {
    codeRevision: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    revisionFile: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      createMany: jest.fn(),
    },
    reviewComment: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const authorization = { require: jest.fn() };
  const audit = { record: jest.fn() };
  const scanner = { scan: jest.fn() };
  const storage = {
    put: jest.fn(),
    read: jest.fn(),
    exists: jest.fn(),
    delete: jest.fn(),
  };
  const config = { get: (_key: string, fallback: unknown) => fallback };
  let service: CodeRepositoryService;

  const textFile = {
    id: 'file-1',
    revisionId: 'revision-1',
    path: 'src/App.ts',
    storageKey: 'private/revision-1/checksum',
    checksum: 'a'.repeat(64),
    size: 12,
    mimeType: 'text/typescript',
    isBinary: false,
    createdAt: new Date('2026-09-12T10:00:00Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    authorization.require.mockResolvedValue({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      role: Role.EDITOR,
      allowViewerComments: false,
    });
    audit.record.mockResolvedValue(undefined);
    prisma.$transaction.mockImplementation((operation) => operation(prisma));
    service = new CodeRepositoryService(
      prisma as any,
      authorization as any,
      audit as any,
      scanner as any,
      storage as any,
      config as any,
    );
  });

  it('returns a safe sorted file tree without physical storage keys', async () => {
    prisma.codeRevision.findFirst.mockResolvedValue({
      id: 'revision-1',
      workspaceId: 'workspace-1',
      status: RevisionStatus.PUBLISHED,
      _count: { files: 2, comments: 0 },
    });
    prisma.revisionFile.findMany.mockResolvedValue([
      textFile,
      { ...textFile, id: 'file-2', path: 'README.md' },
    ]);

    const files = await service.tree('workspace-1', 'revision-1', 'user-1');

    expect(files).toEqual([
      expect.objectContaining({ id: 'file-2', path: 'README.md' }),
      expect.objectContaining({ id: 'file-1', path: 'src/App.ts' }),
    ]);
    expect(files.some((file) => 'storageKey' in file)).toBe(false);
  });

  it('returns binary metadata without reading or decoding its bytes', async () => {
    prisma.revisionFile.findFirst.mockResolvedValue({
      ...textFile,
      isBinary: true,
      mimeType: 'application/octet-stream',
    });

    const file = await service.readFile(
      'workspace-1',
      'revision-1',
      'file-1',
      'user-1',
    );

    expect(file).toEqual({
      id: 'file-1',
      revisionId: 'revision-1',
      path: 'src/App.ts',
      checksum: 'a'.repeat(64),
      size: 12,
      mimeType: 'application/octet-stream',
      isBinary: true,
      createdAt: new Date('2026-09-12T10:00:00Z'),
    });
    expect(storage.read).not.toHaveBeenCalled();
  });

  it('returns UTF-8 content for an authorized textual file', async () => {
    prisma.revisionFile.findFirst.mockResolvedValue(textFile);
    storage.read.mockResolvedValue(Buffer.from('const x = 1;'));

    const file = await service.readFile(
      'workspace-1',
      'revision-1',
      'file-1',
      'user-1',
    );

    expect(file).toMatchObject({ path: 'src/App.ts', content: 'const x = 1;' });
  });

  it('creates a deterministic unified diff for changed text', async () => {
    prisma.codeRevision.findMany.mockResolvedValue([
      { id: 'base', workspaceId: 'workspace-1', status: RevisionStatus.PUBLISHED },
      { id: 'target', workspaceId: 'workspace-1', status: RevisionStatus.PUBLISHED },
    ]);
    prisma.revisionFile.findMany
      .mockResolvedValueOnce([{ ...textFile, revisionId: 'base' }])
      .mockResolvedValueOnce([{ ...textFile, revisionId: 'target', checksum: 'b'.repeat(64) }]);
    storage.read
      .mockResolvedValueOnce(Buffer.from('line one\nold\n'))
      .mockResolvedValueOnce(Buffer.from('line one\nnew\n'));

    const result = await service.compare(
      'workspace-1',
      'base',
      'target',
      'user-1',
    );

    expect(result.files).toEqual([
      expect.objectContaining({
        path: 'src/App.ts',
        kind: 'MODIFIED',
        patch: expect.stringContaining('-old\n+new'),
      }),
    ]);
  });

  it('restores into a new revision and leaves source unchanged', async () => {
    const source = {
      id: 'revision-1',
      workspaceId: 'workspace-1',
      diagramId: 'diagram-1',
      modelVersion: 4,
      authorId: 'original-user',
      projectType: ProjectType.SPRING_BOOT,
      generator: 'spring-ejs@1',
      status: RevisionStatus.PUBLISHED,
      manifest: { fileCount: 1, totalBytes: 12 },
      files: [textFile],
    };
    prisma.codeRevision.findFirst
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce({ id: 'revision-2' });
    let createdRevision: any;
    prisma.codeRevision.create.mockImplementation(({ data }) => {
      createdRevision = {
        ...source,
        ...data,
        id: 'revision-3',
        createdAt: new Date('2026-09-12T11:00:00Z'),
        _count: { files: 1, comments: 0 },
      };
      return Promise.resolve(createdRevision);
    });
    prisma.codeRevision.update.mockImplementation(({ where, data }) =>
      Promise.resolve({
        ...createdRevision,
        ...data,
        id: where.id,
        createdAt: new Date('2026-09-12T11:00:00Z'),
        _count: { files: 1, comments: 0 },
      }),
    );
    prisma.revisionFile.createMany.mockResolvedValue({ count: 1 });

    const restored = await service.restore(
      'workspace-1',
      'revision-1',
      'user-1',
    );

    expect(restored).toMatchObject({
      id: 'revision-3',
      parentRevisionId: 'revision-2',
      restoredFromId: 'revision-1',
      status: RevisionStatus.PUBLISHED,
    });
    expect(prisma.codeRevision.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'revision-1' } }),
    );
  });

  it('trims a valid comment and returns its safe author projection', async () => {
    prisma.revisionFile.findFirst.mockResolvedValue(textFile);
    prisma.reviewComment.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'comment-1',
        ...data,
        createdAt: new Date('2026-09-12T10:00:00Z'),
        updatedAt: new Date('2026-09-12T10:00:00Z'),
        author: { id: 'user-1', name: 'Felix', avatar: null },
      }),
    );

    const comment = await service.createComment(
      'workspace-1',
      'revision-1',
      'user-1',
      { fileId: 'file-1', line: 7, body: '  Revisar nombre  ' },
    );

    expect(comment).toMatchObject({
      body: 'Revisar nombre',
      line: 7,
      author: { id: 'user-1', name: 'Felix', avatar: null },
    });
  });

  it.each(['', '   ', 'x'.repeat(4001)])(
    'rejects invalid comment body',
    async (body) => {
      await expect(
        service.createComment('workspace-1', 'revision-1', 'user-1', {
          fileId: 'file-1',
          body,
        }),
      ).rejects.toThrow();
    },
  );

  it('hides a revision outside the authorized workspace', async () => {
    prisma.codeRevision.findFirst.mockResolvedValue(null);

    await expect(
      service.get('workspace-1', 'foreign-revision', 'user-1'),
    ).rejects.toThrow('Revision not found');
  });

  it('scopes listed comments to the authorized revision and optional file', async () => {
    prisma.reviewComment.findMany.mockResolvedValue([
      {
        id: 'comment-1',
        revisionId: 'revision-1',
        fileId: 'file-1',
        body: 'Review',
      },
    ]);

    const comments = await service.listComments(
      'workspace-1',
      'revision-1',
      'user-1',
      'file-1',
    );

    expect(comments).toHaveLength(1);
    expect(prisma.reviewComment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          revisionId: 'revision-1',
          fileId: 'file-1',
          revision: expect.objectContaining({ workspaceId: 'workspace-1' }),
        }),
      }),
    );
  });

  it('builds a temporary ZIP from authorized revision files', async () => {
    prisma.codeRevision.findFirst.mockResolvedValue({
      id: 'revision-1',
      workspaceId: 'workspace-1',
      status: RevisionStatus.PUBLISHED,
      files: [textFile],
    });
    storage.read.mockResolvedValue(Buffer.from('const x = 1;'));

    const download = await service.download(
      'workspace-1',
      'revision-1',
      'user-1',
    );
    const chunks: Buffer[] = [];
    for await (const chunk of download.stream as any) {
      chunks.push(Buffer.from(chunk));
    }

    expect(download.filename).toBe('revision-revision-1.zip');
    expect(Buffer.concat(chunks).subarray(0, 2).toString('ascii')).toBe('PK');
    await expect(download.cleanup()).resolves.toBeUndefined();
  });

  it('rejects unsafe paths before adding them to a download', async () => {
    prisma.codeRevision.findFirst.mockResolvedValue({
      id: 'revision-1',
      workspaceId: 'workspace-1',
      status: RevisionStatus.PUBLISHED,
      files: [{ ...textFile, path: '../secret.txt' }],
    });

    await expect(
      service.download('workspace-1', 'revision-1', 'user-1'),
    ).rejects.toThrow('Unsafe revision file path');
  });
});
