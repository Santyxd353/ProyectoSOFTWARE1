import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
} from '@nestjs/common';
import { InvitationStatus, Role } from '@prisma/client';
import { InvitationService } from './invitation.service';

describe('InvitationService', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    workspaceCollaborator: { findUnique: jest.fn(), create: jest.fn() },
    workspaceInvitation: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const authorization = { require: jest.fn() };
  const audit = { record: jest.fn() };
  let service: InvitationService;

  beforeEach(() => {
    jest.clearAllMocks();
    authorization.require.mockResolvedValue({ role: Role.OWNER });
    audit.record.mockResolvedValue(undefined);
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    service = new InvitationService(prisma as any, authorization as any, audit as any);
  });

  it('adds an already registered user immediately', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-2', email: 'member@test.com' });
    prisma.workspaceCollaborator.findUnique.mockResolvedValue(null);
    prisma.workspaceCollaborator.create.mockResolvedValue({ id: 'member-1', role: Role.EDITOR });

    const result = await service.invite('workspace-1', 'owner-1', ' MEMBER@Test.com ', Role.EDITOR);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'member@test.com' } });
    expect(result).toEqual(expect.objectContaining({ kind: 'member' }));
  });

  it('creates a pending invitation for an unregistered email', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.workspaceInvitation.findFirst.mockResolvedValue(null);
    prisma.workspaceInvitation.create.mockResolvedValue({ id: 'invite-1', status: InvitationStatus.PENDING });

    const result = await service.invite('workspace-1', 'owner-1', 'new@test.com', Role.VIEWER);

    expect(result).toEqual(expect.objectContaining({ kind: 'invitation' }));
    expect(prisma.workspaceInvitation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ email: 'new@test.com', status: InvitationStatus.PENDING }),
    }));
  });

  it('rejects duplicate pending invitations', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.workspaceInvitation.findFirst.mockResolvedValue({ id: 'invite-1', status: InvitationStatus.PENDING });

    await expect(service.invite('workspace-1', 'owner-1', 'new@test.com', Role.VIEWER))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('claims every pending invitation after registration', async () => {
    prisma.workspaceInvitation.findMany.mockResolvedValue([
      { id: 'invite-1', workspaceId: 'workspace-1', role: Role.EDITOR },
    ]);
    prisma.workspaceCollaborator.findUnique.mockResolvedValue(null);
    prisma.workspaceCollaborator.create.mockResolvedValue({ id: 'member-1' });
    prisma.workspaceInvitation.update.mockResolvedValue({});

    const result = await service.claimForUser('user-2', ' MEMBER@Test.com ');

    expect(result).toEqual({ claimed: 1 });
    expect(prisma.workspaceInvitation.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: InvitationStatus.ACCEPTED, acceptedById: 'user-2' }),
    }));
  });

  it('rejects OWNER as an invitation role', async () => {
    await expect(service.invite('workspace-1', 'owner-1', 'new@test.com', Role.OWNER))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires owner capability to list invitations', async () => {
    authorization.require.mockRejectedValue(new ForbiddenException());

    await expect(service.list('workspace-1', 'editor-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('revokes only a pending invitation scoped to the workspace', async () => {
    prisma.workspaceInvitation.findFirst.mockResolvedValue({ id: 'invite-1', workspaceId: 'workspace-1' });
    prisma.workspaceInvitation.update.mockResolvedValue({ id: 'invite-1', status: InvitationStatus.REVOKED });

    const result = await service.revoke('workspace-1', 'owner-1', 'invite-1');

    expect(result.status).toBe(InvitationStatus.REVOKED);
    expect(audit.record).toHaveBeenCalled();
  });

  it('creates a seven-day portable invitation and stores only hashed secrets', async () => {
    prisma.workspaceInvitation.create.mockImplementation(({ data }) => ({ id: 'portable-1', ...data }));

    const before = Date.now();
    const result = await service.createPortable(
      'workspace-1',
      'owner-1',
      Role.EDITOR,
    );

    const created = prisma.workspaceInvitation.create.mock.calls[0][0].data;
    expect(result.kind).toBe('portable');
    expect(result.code).toMatch(/^[A-Z0-9]{8}$/);
    expect(result.url).toBe(`proyectosoftware1://invite?token=${result.token}`);
    expect(created.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(created.shortCodeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(created.tokenHash).not.toContain(result.token);
    expect(created.shortCodeHash).not.toContain(result.code);
    expect(created.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 7 * 24 * 60 * 60 * 1000 - 1000);
  });

  it('rejects OWNER for a portable invitation', async () => {
    await expect(
      service.createPortable('workspace-1', 'owner-1', Role.OWNER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('claims a portable invitation by short code without elevating an existing member', async () => {
    const invitation = {
      id: 'portable-1',
      workspaceId: 'workspace-1',
      role: Role.EDITOR,
      email: null,
      status: InvitationStatus.PENDING,
      acceptedById: null,
      expiresAt: new Date(Date.now() + 60_000),
    };
    prisma.workspaceInvitation.findFirst.mockResolvedValue(invitation);
    prisma.user.findUnique.mockResolvedValue({ id: 'user-2', email: 'member@test.com' });
    prisma.workspaceCollaborator.findUnique.mockResolvedValue({
      id: 'member-1',
      userId: 'user-2',
      workspaceId: 'workspace-1',
      role: Role.VIEWER,
    });
    prisma.workspaceInvitation.update.mockResolvedValue({
      ...invitation,
      status: InvitationStatus.ACCEPTED,
    });

    const result = await service.claimPortable('user-2', ' abcd-1234 ');

    expect(result.alreadyMember).toBe(true);
    expect(prisma.workspaceCollaborator.create).not.toHaveBeenCalled();
    expect(prisma.workspaceInvitation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          acceptedById: 'user-2',
          status: InvitationStatus.ACCEPTED,
        }),
      }),
    );
  });

  it('rejects an expired portable invitation', async () => {
    prisma.workspaceInvitation.findFirst.mockResolvedValue({
      id: 'portable-1',
      status: InvitationStatus.PENDING,
      expiresAt: new Date(Date.now() - 1),
    });

    await expect(service.claimPortable('user-2', 'ABCD1234')).rejects.toBeInstanceOf(
      GoneException,
    );
  });

  it('rejects a revoked portable invitation', async () => {
    prisma.workspaceInvitation.findFirst.mockResolvedValue({
      id: 'portable-1',
      status: InvitationStatus.REVOKED,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(service.claimPortable('user-2', 'ABCD1234')).rejects.toBeInstanceOf(
      GoneException,
    );
  });

  it('accepts a repeated claim by the same user idempotently', async () => {
    prisma.workspaceInvitation.findFirst.mockResolvedValue({
      id: 'portable-1',
      workspaceId: 'workspace-1',
      status: InvitationStatus.ACCEPTED,
      acceptedById: 'user-2',
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.workspaceCollaborator.findUnique.mockResolvedValue({ id: 'member-1' });

    const result = await service.claimPortable('user-2', 'ABCD1234');

    expect(result).toEqual(
      expect.objectContaining({ alreadyAccepted: true, member: { id: 'member-1' } }),
    );
    expect(prisma.workspaceInvitation.update).not.toHaveBeenCalled();
  });

  it('rejects a portable invitation bound to another email', async () => {
    prisma.workspaceInvitation.findFirst.mockResolvedValue({
      id: 'portable-1',
      workspaceId: 'workspace-1',
      role: Role.VIEWER,
      email: 'expected@test.com',
      status: InvitationStatus.PENDING,
      acceptedById: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.user.findUnique.mockResolvedValue({ id: 'user-2', email: 'other@test.com' });

    await expect(service.claimPortable('user-2', 'ABCD1234')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
