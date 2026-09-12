import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuditAction, Role } from '@prisma/client';
import { WorkspaceService } from './workspace.service';

describe('WorkspaceService member management', () => {
  const prisma = {
    workspace: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    workspaceCollaborator: {
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const authorization = {
    require: jest.fn(),
    getAccess: jest.fn(),
  };
  const audit = { record: jest.fn() };
  let service: WorkspaceService;

  beforeEach(() => {
    jest.clearAllMocks();
    authorization.require.mockResolvedValue({
      workspaceId: 'workspace-1',
      userId: 'owner-1',
      role: Role.OWNER,
      allowViewerComments: false,
    });
    authorization.getAccess.mockResolvedValue({
      workspaceId: 'workspace-1',
      userId: 'owner-1',
      role: Role.OWNER,
      allowViewerComments: false,
    });
    audit.record.mockResolvedValue(undefined);
    service = new WorkspaceService(
      prisma as any,
      authorization as any,
      audit as any,
    );
  });

  it('lists owner and collaborators with the current user role', async () => {
    prisma.workspace.findUnique.mockResolvedValue({
      id: 'workspace-1',
      ownerId: 'owner-1',
      allowViewerComments: false,
      owner: { id: 'owner-1', name: 'Owner', email: 'owner@test.com', avatar: null },
      collaborators: [{
        id: 'member-1',
        role: Role.EDITOR,
        joinedAt: new Date('2026-09-12T10:00:00Z'),
        user: { id: 'editor-1', name: 'Editor', email: 'editor@test.com', avatar: null },
      }],
    });

    const result = await service.listMembers('workspace-1', 'owner-1');

    expect(result.currentUserRole).toBe(Role.OWNER);
    expect(result.members).toEqual([
      expect.objectContaining({ id: 'owner-1', role: Role.OWNER }),
      expect.objectContaining({ id: 'member-1', role: Role.EDITOR }),
    ]);
  });

  it('updates a scoped collaborator role and records audit', async () => {
    prisma.workspaceCollaborator.findFirst.mockResolvedValue({
      id: 'member-1',
      workspaceId: 'workspace-1',
      role: Role.VIEWER,
    });
    prisma.workspaceCollaborator.update.mockResolvedValue({
      id: 'member-1',
      role: Role.EDITOR,
    });

    const result = await service.updateMemberRole(
      'workspace-1',
      'owner-1',
      'member-1',
      Role.EDITOR,
    );

    expect(result.role).toBe(Role.EDITOR);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.MEMBER_ROLE_UPDATED }),
    );
  });

  it('rejects OWNER as a collaborator role', async () => {
    await expect(
      service.updateMemberRole(
        'workspace-1',
        'owner-1',
        'member-1',
        Role.OWNER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not change roles when the actor lacks owner capability', async () => {
    authorization.require.mockRejectedValue(new ForbiddenException());

    await expect(
      service.updateMemberRole(
        'workspace-1',
        'editor-1',
        'member-1',
        Role.EDITOR,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.workspaceCollaborator.update).not.toHaveBeenCalled();
  });

  it('removes only a collaborator scoped to the workspace', async () => {
    prisma.workspaceCollaborator.findFirst.mockResolvedValue({
      id: 'member-1',
      workspaceId: 'workspace-1',
      role: Role.VIEWER,
    });
    prisma.workspaceCollaborator.delete.mockResolvedValue({ id: 'member-1' });

    await expect(
      service.removeMember('workspace-1', 'owner-1', 'member-1'),
    ).resolves.toEqual({ message: 'Member removed' });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.MEMBER_REMOVED }),
    );
  });

  it('updates viewer comment policy only through owner capability', async () => {
    prisma.workspace.update.mockResolvedValue({
      id: 'workspace-1',
      allowViewerComments: true,
    });

    const result = await service.updateRepositoryPolicy(
      'workspace-1',
      'owner-1',
      true,
    );

    expect(result.allowViewerComments).toBe(true);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.REPOSITORY_POLICY_UPDATED }),
    );
  });
});
