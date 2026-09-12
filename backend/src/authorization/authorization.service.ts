import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  WorkspaceAccess,
  WorkspaceCapability,
} from './authorization.types';

const ROLE_CAPABILITIES: Record<Role, readonly WorkspaceCapability[]> = {
  [Role.OWNER]: [
    'repository:read',
    'repository:generate',
    'repository:restore',
    'comment:create',
    'members:manage',
    'policy:manage',
  ],
  [Role.EDITOR]: [
    'repository:read',
    'repository:generate',
    'repository:restore',
    'comment:create',
  ],
  [Role.VIEWER]: ['repository:read'],
};

@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccess(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceAccess> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        collaborators: {
          where: { userId },
          select: { userId: true, role: true },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const role = workspace.ownerId === userId
      ? Role.OWNER
      : workspace.collaborators[0]?.role;

    if (!role) {
      throw new ForbiddenException('Access denied to this workspace');
    }

    return {
      workspaceId,
      userId,
      role,
      allowViewerComments:
        (workspace as typeof workspace & { allowViewerComments?: boolean })
          .allowViewerComments ?? false,
    };
  }

  async require(
    workspaceId: string,
    userId: string,
    capability: WorkspaceCapability,
  ): Promise<WorkspaceAccess> {
    const access = await this.getAccess(workspaceId, userId);
    const viewerCanComment =
      access.role === Role.VIEWER &&
      capability === 'comment:create' &&
      access.allowViewerComments;

    if (
      !viewerCanComment &&
      !ROLE_CAPABILITIES[access.role].includes(capability)
    ) {
      throw new ForbiddenException('Insufficient workspace permissions');
    }

    return access;
  }
}
