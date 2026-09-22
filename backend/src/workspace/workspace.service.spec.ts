import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuditAction, Role } from '@prisma/client';
import { WorkspaceService } from './workspace.service';

describe('WorkspaceService member management', () => {
  const prisma = {
    workspace: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    workspaceCollaborator: {
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
    },
    diagram: { findMany: jest.fn() },
    auditEvent: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  const authorization = {
    require: jest.fn(),
    getAccess: jest.fn(),
  };
  const audit = { record: jest.fn() };
  const realtime = { revokeWorkspaceAccess: jest.fn() };
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
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    service = new WorkspaceService(
      prisma as any,
      authorization as any,
      audit as any,
      realtime as any,
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

  it('separates active and archived diagrams in the workspace response', async () => {
    const active = {
      id: 'diagram-active',
      name: 'Active',
      archivedAt: null,
    };
    const archived = {
      id: 'diagram-archived',
      name: 'Archived',
      archivedAt: new Date('2026-09-13T10:00:00Z'),
    };
    prisma.workspace.findUnique.mockResolvedValue({
      id: 'workspace-1',
      ownerId: 'owner-1',
      owner: { id: 'owner-1' },
      collaborators: [],
      diagrams: [active, archived],
    });

    const result = await service.getWorkspaceById('workspace-1', 'owner-1');

    expect(result.diagrams).toEqual([active]);
    expect(result.archivedDiagrams).toEqual([archived]);
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
      userId: 'viewer-1',
      role: Role.VIEWER,
    });
    prisma.workspaceCollaborator.delete.mockResolvedValue({ id: 'member-1' });
    prisma.diagram.findMany.mockResolvedValue([{ id: 'diagram-1' }, { id: 'diagram-2' }]);

    await expect(
      service.removeMember('workspace-1', 'owner-1', 'member-1'),
    ).resolves.toEqual({ message: 'Member removed' });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.MEMBER_REMOVED }),
    );
    expect(realtime.revokeWorkspaceAccess).toHaveBeenCalledWith(
      'workspace-1',
      'viewer-1',
      ['diagram-1', 'diagram-2'],
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

  it('updates trimmed workspace metadata for the owner', async () => {
    prisma.workspace.update.mockResolvedValue({
      id: 'workspace-1',
      name: 'New name',
      description: 'New description',
    });

    const result = await service.updateWorkspace('workspace-1', 'owner-1', {
      name: '  New name  ',
      description: '  New description  ',
    });

    expect(result.name).toBe('New name');
    expect(prisma.workspace.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { name: 'New name', description: 'New description' },
    }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: AuditAction.WORKSPACE_UPDATED,
    }));
  });

  it('rejects an empty workspace name', async () => {
    await expect(service.updateWorkspace('workspace-1', 'owner-1', { name: '   ' }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('applies search and sorting to owned and collaborated projects', async () => {
    prisma.workspace.findMany.mockResolvedValue([]);

    await service.getUserWorkspaces('user-1', { search: ' api ', sort: 'name_desc' });

    expect(prisma.workspace.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({
        ownerId: 'user-1',
        OR: expect.any(Array),
      }),
      orderBy: { name: 'desc' },
    }));
    expect(prisma.workspace.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({ OR: expect.any(Array) }),
      orderBy: { name: 'desc' },
    }));
  });

  it('transfers ownership atomically and keeps the former owner as editor', async () => {
    prisma.workspace.findUnique.mockResolvedValue({
      id: 'workspace-1',
      name: 'Project Atlas',
      ownerId: 'owner-1',
    });
    prisma.workspaceCollaborator.findFirst.mockResolvedValue({
      id: 'member-1',
      userId: 'editor-1',
      workspaceId: 'workspace-1',
    });
    prisma.workspace.update.mockResolvedValue({ id: 'workspace-1', ownerId: 'editor-1' });
    prisma.workspaceCollaborator.delete.mockResolvedValue({ id: 'member-1' });
    prisma.workspaceCollaborator.upsert.mockResolvedValue({ id: 'former-owner' });

    const result = await service.transferOwnership(
      'workspace-1',
      'owner-1',
      'member-1',
      'Project Atlas',
    );

    expect(result.ownerId).toBe('editor-1');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.workspaceCollaborator.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ userId: 'owner-1', role: Role.EDITOR }),
    }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: AuditAction.WORKSPACE_OWNERSHIP_TRANSFERRED,
    }), expect.anything());
  });

  it('requires the exact workspace name to transfer ownership', async () => {
    prisma.workspace.findUnique.mockResolvedValue({
      id: 'workspace-1',
      name: 'Project Atlas',
      ownerId: 'owner-1',
    });

    await expect(service.transferOwnership(
      'workspace-1',
      'owner-1',
      'member-1',
      'Wrong name',
    )).rejects.toBeInstanceOf(BadRequestException);
  });
});
