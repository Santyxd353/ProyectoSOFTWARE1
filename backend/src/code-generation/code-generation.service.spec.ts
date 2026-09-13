import { ForbiddenException } from '@nestjs/common';
import { ProjectType, RevisionStatus, Role } from '@prisma/client';
import * as path from 'path';
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
});
