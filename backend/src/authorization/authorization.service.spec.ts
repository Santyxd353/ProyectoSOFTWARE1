import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthorizationService } from './authorization.service';

describe('AuthorizationService', () => {
  const prisma = {
    workspace: {
      findUnique: jest.fn(),
    },
  };

  let service: AuthorizationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthorizationService(prisma as any);
  });

  function workspaceFor(role: Role, allowViewerComments = false) {
    return {
      id: 'workspace-1',
      ownerId: role === Role.OWNER ? 'user-1' : 'owner-1',
      allowViewerComments,
      collaborators: role === Role.OWNER
        ? []
        : [{ userId: 'user-1', role }],
    };
  }

  it.each([
    [Role.OWNER, 'repository:read', true],
    [Role.OWNER, 'members:manage', true],
    [Role.EDITOR, 'repository:restore', true],
    [Role.EDITOR, 'members:manage', false],
    [Role.VIEWER, 'repository:read', true],
    [Role.VIEWER, 'repository:restore', false],
    [Role.VIEWER, 'comment:create', false],
  ] as const)('enforces %s access to %s', async (role, capability, allowed) => {
    prisma.workspace.findUnique.mockResolvedValue(workspaceFor(role));

    const operation = service.require('workspace-1', 'user-1', capability);

    if (allowed) {
      await expect(operation).resolves.toMatchObject({ role });
    } else {
      await expect(operation).rejects.toBeInstanceOf(ForbiddenException);
    }
  });

  it('allows viewer comments only when workspace policy is enabled', async () => {
    prisma.workspace.findUnique.mockResolvedValue(workspaceFor(Role.VIEWER, true));

    await expect(
      service.require('workspace-1', 'user-1', 'comment:create'),
    ).resolves.toMatchObject({
      role: Role.VIEWER,
      allowViewerComments: true,
    });
  });

  it('hides a missing workspace behind a not found error', async () => {
    prisma.workspace.findUnique.mockResolvedValue(null);

    await expect(
      service.require('missing', 'user-1', 'repository:read'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('denies users who are neither owner nor collaborator', async () => {
    prisma.workspace.findUnique.mockResolvedValue({
      id: 'workspace-1',
      ownerId: 'owner-1',
      allowViewerComments: false,
      collaborators: [],
    });

    await expect(
      service.require('workspace-1', 'outsider', 'repository:read'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
