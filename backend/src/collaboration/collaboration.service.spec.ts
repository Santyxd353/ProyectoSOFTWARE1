import { ForbiddenException } from '@nestjs/common';
import { CollaborationService } from './collaboration.service';

describe('CollaborationService edit access', () => {
  const diagram = {
    id: 'diagram-1',
    workspace: {
      ownerId: 'owner-1',
      collaborators: [
        { userId: 'editor-1', role: 'EDITOR' },
        { userId: 'viewer-1', role: 'VIEWER' },
      ],
    },
  };

  const prisma = {
    diagram: { findUnique: jest.fn().mockResolvedValue(diagram) },
  };

  it('allows owners and editors to send live diagram previews', async () => {
    const service = new CollaborationService(prisma as any);

    await expect(
      service.assertDiagramEditAccess('diagram-1', 'owner-1'),
    ).resolves.toBeUndefined();
    await expect(
      service.assertDiagramEditAccess('diagram-1', 'editor-1'),
    ).resolves.toBeUndefined();
  });

  it('rejects live edit previews from viewers', async () => {
    const service = new CollaborationService(prisma as any);

    await expect(
      service.assertDiagramEditAccess('diagram-1', 'viewer-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
