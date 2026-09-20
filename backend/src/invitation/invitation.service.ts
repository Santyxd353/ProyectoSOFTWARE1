import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, InvitationStatus, Role } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  async invite(workspaceId: string, actorId: string, rawEmail: string, role: Role) {
    if (role === Role.OWNER) {
      throw new BadRequestException('OWNER cannot be assigned through an invitation');
    }
    await this.authorization.require(workspaceId, actorId, 'members:manage');

    const email = this.normalizeEmail(rawEmail);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      const existingMember = await this.prisma.workspaceCollaborator.findUnique({
        where: { userId_workspaceId: { userId: user.id, workspaceId } },
      });
      if (existingMember) throw new ConflictException('User is already a collaborator');

      const member = await this.prisma.workspaceCollaborator.create({
        data: { userId: user.id, workspaceId, role },
        include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
      });
      await this.audit.record({
        workspaceId,
        actorId,
        action: AuditAction.INVITATION_CLAIMED,
        entityType: 'WorkspaceCollaborator',
        entityId: member.id,
        metadata: { email, immediate: true },
      });
      return { kind: 'member' as const, member };
    }

    const existing = await this.prisma.workspaceInvitation.findFirst({
      where: { workspaceId, email },
    });
    if (existing?.status === InvitationStatus.PENDING) {
      throw new ConflictException('A pending invitation already exists for this email');
    }

    const invitation = existing
      ? await this.prisma.workspaceInvitation.update({
          where: { id: existing.id },
          data: {
            role,
            status: InvitationStatus.PENDING,
            invitedById: actorId,
            acceptedById: null,
          },
        })
      : await this.prisma.workspaceInvitation.create({
          data: {
            workspaceId,
            email,
            role,
            status: InvitationStatus.PENDING,
            invitedById: actorId,
          },
        });

    await this.audit.record({
      workspaceId,
      actorId,
      action: AuditAction.INVITATION_CREATED,
      entityType: 'WorkspaceInvitation',
      entityId: invitation.id,
      metadata: { email, role },
    });
    return { kind: 'invitation' as const, invitation };
  }

  async claimForUser(userId: string, rawEmail: string, transactionClient?: any) {
    const execute = async (db: any) => {
      const email = this.normalizeEmail(rawEmail);
      const invitations = await db.workspaceInvitation.findMany({
        where: { email, status: InvitationStatus.PENDING },
      });

      for (const invitation of invitations) {
        const existingMember = await db.workspaceCollaborator.findUnique({
          where: {
            userId_workspaceId: { userId, workspaceId: invitation.workspaceId },
          },
        });
        if (!existingMember) {
          await db.workspaceCollaborator.create({
            data: { userId, workspaceId: invitation.workspaceId, role: invitation.role },
          });
        }
        await db.workspaceInvitation.update({
          where: { id: invitation.id },
          data: { status: InvitationStatus.ACCEPTED, acceptedById: userId },
        });
        if (db.auditEvent?.create) {
          await db.auditEvent.create({
            data: {
              workspaceId: invitation.workspaceId,
              actorId: userId,
              action: AuditAction.INVITATION_CLAIMED,
              entityType: 'WorkspaceInvitation',
              entityId: invitation.id,
              metadata: { email },
            },
          });
        }
      }
      return { claimed: invitations.length };
    };

    return transactionClient
      ? execute(transactionClient)
      : this.prisma.$transaction((db) => execute(db));
  }

  async createPortable(
    workspaceId: string,
    actorId: string,
    role: Role,
    expiresInHours = 7 * 24,
    rawEmail?: string,
  ) {
    if (role === Role.OWNER) {
      throw new BadRequestException('OWNER cannot be assigned through an invitation');
    }
    if (!Number.isInteger(expiresInHours) || expiresInHours < 1 || expiresInHours > 720) {
      throw new BadRequestException('Invitation expiry must be between 1 and 720 hours');
    }
    await this.authorization.require(workspaceId, actorId, 'members:manage');

    const token = randomBytes(32).toString('base64url');
    const code = this.generateShortCode();
    const email = rawEmail ? this.normalizeEmail(rawEmail) : null;
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
    const invitation = await this.prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        email,
        role,
        status: InvitationStatus.PENDING,
        invitedById: actorId,
        tokenHash: this.hashSecret(token),
        shortCodeHash: this.hashSecret(code),
        expiresAt,
      },
    });

    await this.audit.record({
      workspaceId,
      actorId,
      action: AuditAction.INVITATION_CREATED,
      entityType: 'WorkspaceInvitation',
      entityId: invitation.id,
      metadata: { role, emailBound: Boolean(email), expiresAt: expiresAt.toISOString() },
    });

    return {
      kind: 'portable' as const,
      invitation,
      token,
      code,
      url: `proyectosoftware1://invite?token=${token}`,
    };
  }

  async claimPortable(userId: string, rawSecret: string) {
    const { tokenHash, shortCodeHash } = this.portableHashes(rawSecret);
    return this.prisma.$transaction(async (db: any) => {
      const invitation = await db.workspaceInvitation.findFirst({
        where: {
          OR: [{ tokenHash }, { shortCodeHash }],
        },
      });
      if (!invitation) throw new NotFoundException('Invitation not found');

      if (invitation.status === InvitationStatus.ACCEPTED) {
        if (invitation.acceptedById !== userId) {
          throw new GoneException('Invitation has already been used');
        }
        const member = await db.workspaceCollaborator.findUnique({
          where: {
            userId_workspaceId: { userId, workspaceId: invitation.workspaceId },
          },
        });
        return { invitation, member, alreadyAccepted: true, alreadyMember: true };
      }
      if (invitation.status !== InvitationStatus.PENDING) {
        throw new GoneException('Invitation is no longer available');
      }
      if (invitation.expiresAt && invitation.expiresAt.getTime() <= Date.now()) {
        throw new GoneException('Invitation has expired');
      }

      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException('User not found');
      if (invitation.email && this.normalizeEmail(user.email) !== invitation.email) {
        throw new ForbiddenException('Invitation belongs to another email');
      }

      let member = await db.workspaceCollaborator.findUnique({
        where: {
          userId_workspaceId: { userId, workspaceId: invitation.workspaceId },
        },
      });
      const alreadyMember = Boolean(member);
      if (!member) {
        member = await db.workspaceCollaborator.create({
          data: { userId, workspaceId: invitation.workspaceId, role: invitation.role },
        });
      }

      const accepted = await db.workspaceInvitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedById: userId,
          claimedAt: new Date(),
        },
      });
      if (db.auditEvent?.create) {
        await db.auditEvent.create({
          data: {
            workspaceId: invitation.workspaceId,
            actorId: userId,
            action: AuditAction.INVITATION_CLAIMED,
            entityType: 'WorkspaceInvitation',
            entityId: invitation.id,
            metadata: { portable: true, alreadyMember },
          },
        });
      }
      return { invitation: accepted, member, alreadyAccepted: false, alreadyMember };
    });
  }

  async list(workspaceId: string, actorId: string) {
    await this.authorization.require(workspaceId, actorId, 'members:manage');
    return this.prisma.workspaceInvitation.findMany({
      where: { workspaceId, status: InvitationStatus.PENDING },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(workspaceId: string, actorId: string, invitationId: string) {
    await this.authorization.require(workspaceId, actorId, 'members:manage');
    const invitation = await this.prisma.workspaceInvitation.findFirst({
      where: { id: invitationId, workspaceId, status: InvitationStatus.PENDING },
    });
    if (!invitation) throw new NotFoundException('Pending invitation not found');

    const revoked = await this.prisma.workspaceInvitation.update({
      where: { id: invitationId },
      data: { status: InvitationStatus.REVOKED },
    });
    await this.audit.record({
      workspaceId,
      actorId,
      action: AuditAction.INVITATION_REVOKED,
      entityType: 'WorkspaceInvitation',
      entityId: invitationId,
    });
    return revoked;
  }

  private normalizeEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    if (!normalized) throw new BadRequestException('Email is required');
    return normalized;
  }

  private hashSecret(value: string) {
    return createHash('sha256').update(value, 'utf8').digest('hex');
  }

  private generateShortCode() {
    let code = '';
    while (code.length < 8) {
      code += randomBytes(8)
        .toString('base64url')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase();
    }
    return code.slice(0, 8);
  }

  private portableHashes(rawSecret: string) {
    const trimmed = rawSecret.trim();
    if (!trimmed) throw new BadRequestException('Invitation code or link is required');

    let token = trimmed;
    try {
      const url = new URL(trimmed);
      token = url.searchParams.get('token') ?? trimmed;
    } catch {
      // A manual code or raw token is expected to be non-URL text.
    }
    const normalizedCode = trimmed.replace(/[\s-]/g, '').toUpperCase();
    return {
      tokenHash: this.hashSecret(token),
      shortCodeHash: this.hashSecret(normalizedCode),
    };
  }
}
