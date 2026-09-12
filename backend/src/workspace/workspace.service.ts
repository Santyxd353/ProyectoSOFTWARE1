import {
  BadRequestException,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, Role } from '@prisma/client';
import { AuthorizationService } from '../authorization/authorization.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  async createWorkspace(userId: string, name: string, description?: string) {
    return this.prisma.workspace.create({
      data: {
        name,
        description,
        ownerId: userId,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            collaborators: true,
            diagrams: true,
          },
        },
      },
    });
  }

  async getUserWorkspaces(userId: string) {
    const ownedWorkspaces = await this.prisma.workspace.findMany({
      where: { ownerId: userId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            collaborators: true,
            diagrams: true,
          },
        },
      },
    });

    const collaboratedWorkspaces = await this.prisma.workspace.findMany({
      where: {
        collaborators: {
          some: { userId },
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        collaborators: {
          where: { userId },
          select: { role: true },
        },
        _count: {
          select: {
            collaborators: true,
            diagrams: true,
          },
        },
      },
    });

    return {
      owned: ownedWorkspaces,
      collaborated: collaboratedWorkspaces,
    };
  }

  async getWorkspaceById(workspaceId: string, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        collaborators: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
        diagrams: {
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            name: true,
            version: true,
            data: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const access = await this.authorization.getAccess(workspaceId, userId);
    return { ...workspace, currentUserRole: access.role };
  }

  async addCollaborator(workspaceId: string, ownerId: string, email: string, role: Role = Role.VIEWER) {
    if (role === Role.OWNER) {
      throw new BadRequestException('OWNER cannot be assigned to a collaborator');
    }
    // Verify ownership
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId, ownerId },
    });

    if (!workspace) {
      throw new ForbiddenException('Only workspace owner can add collaborators');
    }

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if already a collaborator
    const existingCollaborator = await this.prisma.workspaceCollaborator.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId,
        },
      },
    });

    if (existingCollaborator) {
      throw new ForbiddenException('User is already a collaborator');
    }

    return this.prisma.workspaceCollaborator.create({
      data: {
        userId: user.id,
        workspaceId,
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });
  }

  async listMembers(workspaceId: string, userId: string) {
    const access = await this.authorization.getAccess(workspaceId, userId);
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        collaborators: {
          orderBy: { joinedAt: 'asc' },
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
        },
      },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');

    return {
      workspaceId,
      currentUserRole: access.role,
      allowViewerComments: workspace.allowViewerComments,
      members: [
        {
          id: workspace.owner.id,
          userId: workspace.owner.id,
          role: Role.OWNER,
          joinedAt: null,
          user: workspace.owner,
        },
        ...workspace.collaborators.map((member) => ({
          id: member.id,
          userId: member.userId,
          role: member.role,
          joinedAt: member.joinedAt,
          user: member.user,
        })),
      ],
    };
  }

  async updateMemberRole(
    workspaceId: string,
    actorId: string,
    memberId: string,
    role: Role,
  ) {
    if (role === Role.OWNER) {
      throw new BadRequestException('OWNER cannot be assigned to a collaborator');
    }
    await this.authorization.require(workspaceId, actorId, 'members:manage');
    const member = await this.prisma.workspaceCollaborator.findFirst({
      where: { id: memberId, workspaceId },
    });
    if (!member) throw new NotFoundException('Workspace member not found');

    const updated = await this.prisma.workspaceCollaborator.update({
      where: { id: member.id },
      data: { role },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });
    await this.audit.record({
      workspaceId,
      actorId,
      action: AuditAction.MEMBER_ROLE_UPDATED,
      entityType: 'WorkspaceCollaborator',
      entityId: member.id,
      metadata: { previousRole: member.role, role },
    });
    return updated;
  }

  async removeMember(
    workspaceId: string,
    actorId: string,
    memberId: string,
  ) {
    await this.authorization.require(workspaceId, actorId, 'members:manage');
    const member = await this.prisma.workspaceCollaborator.findFirst({
      where: { id: memberId, workspaceId },
    });
    if (!member) throw new NotFoundException('Workspace member not found');
    await this.prisma.workspaceCollaborator.delete({ where: { id: member.id } });
    await this.audit.record({
      workspaceId,
      actorId,
      action: AuditAction.MEMBER_REMOVED,
      entityType: 'WorkspaceCollaborator',
      entityId: member.id,
      metadata: { role: member.role },
    });
    return { message: 'Member removed' };
  }

  async updateRepositoryPolicy(
    workspaceId: string,
    actorId: string,
    allowViewerComments: boolean,
  ) {
    await this.authorization.require(workspaceId, actorId, 'policy:manage');
    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { allowViewerComments },
      select: { id: true, allowViewerComments: true },
    });
    await this.audit.record({
      workspaceId,
      actorId,
      action: AuditAction.REPOSITORY_POLICY_UPDATED,
      entityType: 'Workspace',
      entityId: workspaceId,
      metadata: { allowViewerComments },
    });
    return workspace;
  }
}
