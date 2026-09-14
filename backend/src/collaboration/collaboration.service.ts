import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

interface ConnectedUser {
  socketId: string;
  userId: string;
  userName: string;
  diagramId: string;
}

@Injectable()
export class CollaborationService {
  private connectedUsers = new Map<string, ConnectedUser>();

  constructor(private prisma: PrismaService) {}

  async joinDiagram(
    client: Socket,
    data: { diagramId: string; userId: string; userName: string },
  ) {
    await this.assertDiagramAccess(data.diagramId, data.userId);
    client.join(data.diagramId);
    this.connectedUsers.set(client.id, {
      socketId: client.id,
      userId: data.userId,
      userName: data.userName,
      diagramId: data.diagramId,
    });
    return true;
  }

  async assertDiagramAccess(diagramId: string, userId: string): Promise<void> {
    const diagram = await this.prisma.diagram.findUnique({
      where: { id: diagramId },
      include: {
        workspace: {
          include: {
            collaborators: true,
          },
        },
      },
    });

    if (!diagram) {
      throw new Error('Diagram not found');
    }

    // Check access
    const hasAccess = diagram.workspace.ownerId === userId ||
      diagram.workspace.collaborators.some(c => c.userId === userId);

    if (!hasAccess) {
      throw new Error('Access denied to this diagram');
    }

  }

  async assertDiagramEditAccess(
    diagramId: string,
    userId: string,
  ): Promise<void> {
    const diagram = await this.prisma.diagram.findUnique({
      where: { id: diagramId },
      include: { workspace: { include: { collaborators: true } } },
    });
    if (!diagram) throw new NotFoundException('Diagram not found');
    const role = diagram.workspace.collaborators.find(
      (item) => item.userId === userId,
    )?.role;
    if (diagram.workspace.ownerId !== userId && role !== 'EDITOR') {
      throw new ForbiddenException('Viewer role cannot edit diagrams');
    }
  }

  handleDisconnect(socketId: string) {
    const user = this.connectedUsers.get(socketId);
    if (user) {
      this.connectedUsers.delete(socketId);
      // Could emit user_left event here if needed
    }
  }

  getConnectedUsers(diagramId: string): ConnectedUser[] {
    return Array.from(this.connectedUsers.values())
      .filter(user => user.diagramId === diagramId);
  }
}
