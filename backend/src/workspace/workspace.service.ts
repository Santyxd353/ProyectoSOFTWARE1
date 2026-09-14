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

  async getUserWorkspaces(
    userId: string,
    options: {
      search?: string;
      sort?: 'updated_desc' | 'updated_asc' | 'name_asc' | 'name_desc';
    } = {},
  ) {
    const search = options.search?.trim();
    const orderBy = options.sort === 'updated_asc'
      ? { updatedAt: 'asc' as const }
      : options.sort === 'name_asc'
        ? { name: 'asc' as const }
        : options.sort === 'name_desc'
          ? { name: 'desc' as const }
          : { updatedAt: 'desc' as const };
    const searchFilter = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const ownedWorkspaces = await this.prisma.workspace.findMany({
      where: { ownerId: userId, ...searchFilter },
      orderBy,
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
        ...searchFilter,
      },
      orderBy,
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

  async updateWorkspace(
    workspaceId: string,
    actorId: string,
    input: { name?: string; description?: string },
  ) {
    await this.authorization.require(workspaceId, actorId, 'members:manage');
    const data: { name?: string; description?: string | null } = {};
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new BadRequestException('Workspace name cannot be empty');
      data.name = name;
    }
    if (input.description !== undefined) {
      data.description = input.description.trim() || null;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No workspace changes were provided');
    }

    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data,
    });
    await this.audit.record({
      workspaceId,
      actorId,
      action: AuditAction.WORKSPACE_UPDATED,
      entityType: 'Workspace',
      entityId: workspaceId,
      metadata: { fields: Object.keys(data) },
    });
    return workspace;
  }

  async transferOwnership(
    workspaceId: string,
    actorId: string,
    memberId: string,
    confirmationName: string,
  ) {
    await this.authorization.require(workspaceId, actorId, 'members:manage');
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true, ownerId: true },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
    if (workspace.ownerId !== actorId) {
      throw new ForbiddenException('Only workspace owner can transfer ownership');
    }
    if (confirmationName.trim() !== workspace.name) {
      throw new BadRequestException('Workspace name confirmation does not match');
    }

    const member = await this.prisma.workspaceCollaborator.findFirst({
      where: { id: memberId, workspaceId },
    });
    if (!member) throw new NotFoundException('Workspace member not found');

    return this.prisma.$transaction(async (db) => {
      const updated = await db.workspace.update({
        where: { id: workspaceId },
        data: { ownerId: member.userId },
      });
      await db.workspaceCollaborator.delete({ where: { id: member.id } });
      await db.workspaceCollaborator.upsert({
        where: { userId_workspaceId: { userId: actorId, workspaceId } },
        create: { userId: actorId, workspaceId, role: Role.EDITOR },
        update: { role: Role.EDITOR },
      });
      await this.audit.record({
        workspaceId,
        actorId,
        action: AuditAction.WORKSPACE_OWNERSHIP_TRANSFERRED,
        entityType: 'Workspace',
        entityId: workspaceId,
        metadata: { previousOwnerId: actorId, newOwnerId: member.userId },
      }, db);
      return updated;
    });
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
            archivedAt: true,
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
    const { diagrams, ...workspaceData } = workspace;
    return {
      ...workspaceData,
      diagrams: diagrams.filter((diagram) => !diagram.archivedAt),
      archivedDiagrams: diagrams.filter((diagram) => Boolean(diagram.archivedAt)),
      currentUserRole: access.role,
    };
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
