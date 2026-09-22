import { ForbiddenException } from '@nestjs/common';
import { ProjectType, RevisionStatus, Role } from '@prisma/client';
import * as path from 'path';
import { mkdtemp, mkdir, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { CodeGenerationService } from './code-generation.service';

describe('CodeGenerationService repository integration', () => {
  const prisma = {
    retryQuery: jest.fn(),
    diagram: { findUnique: jest.fn() },
    generatedCode: { create: jest.fn(), findUnique: jest.fn() },
  };
  const repository = {
    publishGeneratedProject: jest.fn(),
    download: jest.fn(),
  };
  const authorization = { require: jest.fn() };
  let service: CodeGenerationService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.retryQuery.mockImplementation((operation) => operation());
    prisma.diagram.findUnique.mockResolvedValue({
      id: 'diagram-1',
      name: 'Users API',
      workspaceId: 'workspace-1',
      version: 7,
      data: {
        classes: [{
          id: 'class-1',
          name: 'User',
          attributes: [{
            id: 'attribute-1',
            name: 'id',
            type: 'Long',
            stereotype: 'id',
            nullable: false,
            unique: true,
          }],
          methods: [],
        }],
        relations: [],
      },
    });
    authorization.require.mockResolvedValue({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      role: Role.EDITOR,
      allowViewerComments: false,
    });
    repository.publishGeneratedProject.mockResolvedValue({
      id: 'revision-1',
      status: RevisionStatus.PUBLISHED,
    });
    prisma.generatedCode.create.mockResolvedValue({ id: 'generated-1' });

    service = new CodeGenerationService(
      prisma as any,
      repository as any,
      authorization as any,
    );
    jest.spyOn(service as any, 'createProjectStructure').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'generateFromTemplates').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'writeApiArtifacts').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'createZipFile').mockResolvedValue(undefined);
  });

  it('publishes exactly one revision after successful Spring generation', async () => {
    const result = await service.generateSpringBootProject('diagram-1', 'user-1');

    expect(result).toMatchObject({
      success: true,
      generatedCodeId: 'generated-1',
      revisionId: 'revision-1',
    });
    expect(repository.publishGeneratedProject).toHaveBeenCalledTimes(1);
    expect(repository.publishGeneratedProject).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        diagramId: 'diagram-1',
        modelVersion: 7,
        authorId: 'user-1',
        projectType: ProjectType.SPRING_BOOT,
        generator: 'spring-ejs@1',
      }),
    );
    expect((service as any).writeApiArtifacts).toHaveBeenCalledWith(
      expect.any(String),
      'Users API',
      expect.arrayContaining([expect.objectContaining({ className: 'User' })]),
    );
  });

  it('denies a legacy download to a user outside the workspace', async () => {
    prisma.generatedCode.findUnique.mockResolvedValue({
      id: 'generated-1',
      zipPath: './generated-projects/private.zip',
      revisionId: null,
      diagram: { workspaceId: 'workspace-1' },
    });
    authorization.require.mockRejectedValue(new ForbiddenException());

    await expect(
      service.downloadProject('generated-1', 'intruder'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('renders the tracked environment example into generated projects', async () => {
    (service as any).generateFromTemplates.mockRestore();
    const renderTemplate = jest
      .spyOn(service as any, 'renderTemplate')
      .mockResolvedValue(undefined);

    await (service as any).generateFromTemplates('generated/project', {
      projectName: 'users-api',
      basePackage: 'com.example.usersapi',
      dbName: 'users_api',
      classes: [],
      relations: [],
    });

    expect(renderTemplate).toHaveBeenCalledWith(
      expect.stringMatching(/[\\/]templates[\\/]springboot[\\/]\.env\.example$/),
      path.join('generated/project', '.env.example'),
      expect.objectContaining({ projectName: 'users-api', dbName: 'users_api' }),
    );
  });

  it('rejects a confirmed refinement when the diagram version changed', async () => {
    await expect(service.generateSpringBootProject('diagram-1', 'user-1', {
      features: ['HEALTH_ENDPOINT'],
      engine: 'claude-haiku-test',
      promptSummary: 'Add health',
      modelVersion: 6,
      planSummary: 'Health check',
    })).rejects.toThrow('diagram changed');

    expect(repository.publishGeneratedProject).not.toHaveBeenCalled();
  });

  it('applies only deterministic refinement features and writes traceability', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'puds-refinement-'));
    const javaRoot = path.join(root, 'src/main/java/com/example/orders/controller');
    await mkdir(javaRoot, { recursive: true });
    try {
      await (service as any).applyBackendRefinement(root, 'com.example.orders', {
        features: ['HEALTH_ENDPOINT', 'REQUEST_LOGGING'],
        engine: 'claude-haiku-test',
        promptSummary: 'Add health and logs',
        modelVersion: 8,
        planSummary: 'Operational visibility',
      });

      expect(await readFile(path.join(javaRoot, 'HealthController.java'), 'utf8'))
        .toContain('@RequestMapping("/api/health")');
      expect(await readFile(
        path.join(root, 'src/main/java/com/example/orders/config/RequestLoggingFilter.java'),
        'utf8',
      )).toContain('OncePerRequestFilter');
      expect(JSON.parse(await readFile(path.join(root, 'backend-refinement.json'), 'utf8')))
        .toMatchObject({ modelVersion: 8, features: ['HEALTH_ENDPOINT', 'REQUEST_LOGGING'] });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('stores generated projects under the configured persistent root without path traversal', async () => {
    const previous = process.env.GENERATED_PROJECTS_PATH;
    const root = path.join(tmpdir(), 'puds-persistent-projects');
    process.env.GENERATED_PROJECTS_PATH = root;
    prisma.diagram.findUnique.mockResolvedValueOnce({
      id: 'diagram-1', name: '../Outside', workspaceId: 'workspace-1', version: 7,
      data: { classes: [{ id: 'class-1', name: 'User', attributes: [{ id: 'a', name: 'id', type: 'Long', stereotype: 'id' }], methods: [] }], relations: [] },
    });
    try {
      const result = await service.generateSpringBootProject('diagram-1', 'user-1');
      expect(path.relative(root, result.projectPath).startsWith('..')).toBe(false);
      expect(result.projectPath).toContain(root);
    } finally {
      if (previous === undefined) delete process.env.GENERATED_PROJECTS_PATH;
      else process.env.GENERATED_PROJECTS_PATH = previous;
    }
  });

  it('adds an API documentation guide when only that refinement is selected', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'puds-refinement-docs-'));
    try {
      await (service as any).applyBackendRefinement(root, 'com.example.orders', {
        features: ['API_DOCUMENTATION'],
        engine: 'gemini-test',
        promptSummary: 'Document endpoints',
        modelVersion: 8,
        planSummary: 'API docs',
      });
      expect(await readFile(path.join(root, 'API_DOCUMENTATION.md'), 'utf8'))
        .toContain('openapi.json');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
