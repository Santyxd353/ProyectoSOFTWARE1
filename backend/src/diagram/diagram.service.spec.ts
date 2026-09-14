import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DiagramService } from './diagram.service';

describe('DiagramService lifecycle', () => {
  const diagram = {
    id: 'diagram-1',
    workspaceId: 'workspace-1',
    archivedAt: null,
    workspace: {
      ownerId: 'owner-1',
      collaborators: [],
    },
    classes: [],
    relations: [],
    data: {},
  };

  function createService(currentDiagram = diagram) {
    const prisma = {
      diagram: {
        findUnique: jest.fn().mockResolvedValue(currentDiagram),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ ...currentDiagram, ...data }),
        ),
        delete: jest.fn(),
      },
      diagramActivity: { create: jest.fn() },
    };
    const audit = { record: jest.fn().mockResolvedValue({ id: 'audit-1' }) };
    const service = new (DiagramService as any)(prisma, audit) as DiagramService & {
      archiveDiagram(id: string, actorId: string): Promise<unknown>;
      restoreDiagram(id: string, actorId: string): Promise<unknown>;
    };
    return { service, prisma, audit };
  }

  it('archives an owned diagram without physically deleting it', async () => {
    const { service, prisma, audit } = createService();

    const result = await service.archiveDiagram('diagram-1', 'owner-1');

    expect(result).toMatchObject({ id: 'diagram-1' });
    expect(prisma.diagram.update).toHaveBeenCalledWith({
      where: { id: 'diagram-1' },
      data: { archivedAt: expect.any(Date) },
    });
    expect(prisma.diagram.delete).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: 'workspace-1',
      actorId: 'owner-1',
      entityId: 'diagram-1',
    }));
  });

  it('rejects archive attempts from collaborators', async () => {
    const { service, prisma } = createService({
      ...diagram,
      workspace: {
        ownerId: 'owner-1',
        collaborators: [{ userId: 'editor-1', role: 'EDITOR' }],
      },
    } as any);

    await expect(service.archiveDiagram('diagram-1', 'editor-1'))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.diagram.update).not.toHaveBeenCalled();
  });

  it('restores an archived diagram while preserving its identity', async () => {
    const archivedAt = new Date('2026-09-13T12:00:00.000Z');
    const { service, prisma, audit } = createService({ ...diagram, archivedAt });

    const result = await service.restoreDiagram('diagram-1', 'owner-1');

    expect(result).toMatchObject({ id: 'diagram-1', archivedAt: null });
    expect(prisma.diagram.update).toHaveBeenCalledWith({
      where: { id: 'diagram-1' },
      data: { archivedAt: null },
    });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: 'workspace-1',
      actorId: 'owner-1',
      entityId: 'diagram-1',
    }));
  });

  it('rejects archiving a diagram that is already archived', async () => {
    const { service, prisma } = createService({
      ...diagram,
      archivedAt: new Date('2026-09-13T12:00:00.000Z'),
    });

    await expect(service.archiveDiagram('diagram-1', 'owner-1'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.diagram.update).not.toHaveBeenCalled();
  });

  it('rejects restoring an active diagram', async () => {
    const { service, prisma } = createService();

    await expect(service.restoreDiagram('diagram-1', 'owner-1'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.diagram.update).not.toHaveBeenCalled();
  });

  it('rejects diagram edits from viewers', async () => {
    const { service, prisma } = createService({
      ...diagram,
      workspace: {
        ownerId: 'owner-1',
        collaborators: [{ userId: 'viewer-1', role: 'VIEWER' }],
      },
    } as any);

    await expect(service.updateDiagram('diagram-1', 'viewer-1', { classes: [], relations: [] }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.diagram.update).not.toHaveBeenCalled();
  });

  it('rejects edits to archived diagrams', async () => {
    const { service, prisma } = createService({
      ...diagram,
      archivedAt: new Date('2026-09-13T12:00:00.000Z'),
    });

    await expect(service.updateDiagram('diagram-1', 'owner-1', { classes: [], relations: [] }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.diagram.update).not.toHaveBeenCalled();
  });
});
