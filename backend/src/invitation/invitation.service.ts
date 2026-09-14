import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, InvitationStatus, Role } from '@prisma/client';
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

    const existing = await this.prisma.workspaceInvitation.findUnique({
      where: { workspaceId_email: { workspaceId, email } },
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
}
