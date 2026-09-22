import { Injectable } from '@nestjs/common';
import { Namespace, Server, Socket } from 'socket.io';

@Injectable()
export class RepositoryRealtimeService {
  private server?: Server | Namespace;

  attachServer(server: Server | Namespace): void {
    this.server = server;
  }

  emitDiagramChange(diagramId: string, event: unknown): void {
    this.server?.to(diagramId).emit('diagram_change', event);
  }

  emitReviewComment(
    workspaceId: string,
    revisionId: string,
    comment: unknown,
  ): void {
    this.server
      ?.to(`workspace:${workspaceId}:revision:${revisionId}`)
      .emit('review_comment_created', comment);
  }

  async revokeWorkspaceAccess(
    workspaceId: string,
    userId: string,
    diagramIds: string[],
  ): Promise<void> {
    const socketContainer = this.server?.sockets;
    const sockets = socketContainer instanceof Map
      ? socketContainer as Map<string, Socket>
      : socketContainer?.sockets;
    if (!sockets) return;

    const diagramRooms = new Set(diagramIds);
    const revisionPrefix = `workspace:${workspaceId}:revision:`;
    for (const socket of sockets.values()) {
      if (socket.data.user?.id !== userId) continue;
      const revokedRooms = [...socket.rooms].filter(
        (room) => diagramRooms.has(room) || room.startsWith(revisionPrefix),
      );
      await Promise.all(revokedRooms.map((room) => socket.leave(room)));
      socket.emit('workspace_access_revoked', { workspaceId });
    }
  }
}
