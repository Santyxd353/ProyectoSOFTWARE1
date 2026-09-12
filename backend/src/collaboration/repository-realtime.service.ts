import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class RepositoryRealtimeService {
  private server?: Server;

  attachServer(server: Server): void {
    this.server = server;
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
}
