import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { RevisionStatus } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { AuthorizationService } from '../authorization/authorization.service';
import { PrismaService } from '../prisma/prisma.service';
import { CollaborationService } from './collaboration.service';
import { RepositoryRealtimeService } from './repository-realtime.service';
import {
  AuthenticatedSocketUser,
  SocketAuthService,
} from './socket-auth.service';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/collaboration',
})
export class CollaborationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly collaboration: CollaborationService,
    private readonly socketAuth: SocketAuthService,
    private readonly authorization: AuthorizationService,
    private readonly prisma: PrismaService,
    private readonly realtime: RepositoryRealtimeService,
  ) {}

  afterInit(server: Server): void {
    this.realtime.attachServer(server);
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      await this.socketAuth.authenticate(client);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.collaboration.handleDisconnect(client.id);
  }

  @SubscribeMessage('join_diagram')
  async handleJoinDiagram(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { diagramId: string },
  ) {
    try {
      const user = this.user(client);
      await this.collaboration.joinDiagram(client, {
        diagramId: data.diagramId,
        userId: user.id,
        userName: user.name,
      });
      client.to(data.diagramId).emit('user_joined', {
        userId: user.id,
        userName: user.name,
        socketId: client.id,
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('leave_diagram')
  handleLeaveDiagram(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { diagramId: string },
  ) {
    const user = this.user(client);
    client.leave(data.diagramId);
    client.to(data.diagramId).emit('user_left', {
      userId: user.id,
      socketId: client.id,
    });
    return { success: true };
  }

  @SubscribeMessage('diagram_change')
  async handleDiagramChange(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { diagramId: string; changes: unknown },
  ) {
    const user = this.user(client);
    await this.collaboration.assertDiagramAccess(data.diagramId, user.id);
    client.to(data.diagramId).emit('diagram_change', {
      changes: data.changes,
      userId: user.id,
      timestamp: new Date().toISOString(),
    });
    return { success: true };
  }

  @SubscribeMessage('cursor_position')
  async handleCursorPosition(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { diagramId: string; position: { x: number; y: number } },
  ) {
    const user = this.user(client);
    await this.collaboration.assertDiagramAccess(data.diagramId, user.id);
    client.to(data.diagramId).emit('cursor_position', {
      position: data.position,
      userId: user.id,
      socketId: client.id,
    });
  }

  @SubscribeMessage('element_selected')
  async handleElementSelected(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { diagramId: string; elementId: string },
  ) {
    const user = this.user(client);
    await this.collaboration.assertDiagramAccess(data.diagramId, user.id);
    client.to(data.diagramId).emit('element_selected', {
      elementId: data.elementId,
      userId: user.id,
      socketId: client.id,
    });
  }

  @SubscribeMessage('join_revision')
  async handleJoinRevision(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { workspaceId: string; revisionId: string },
  ) {
    const user = this.user(client);
    await this.authorization.require(
      data.workspaceId,
      user.id,
      'repository:read',
    );
    const revision = await this.prisma.codeRevision.findFirst({
      where: {
        id: data.revisionId,
        workspaceId: data.workspaceId,
        status: RevisionStatus.PUBLISHED,
      },
      select: { id: true },
    });
    if (!revision) throw new WsException('Revision not found');
    await client.join(
      `workspace:${data.workspaceId}:revision:${data.revisionId}`,
    );
    return { success: true };
  }

  private user(client: Socket): AuthenticatedSocketUser {
    const user = client.data.user as AuthenticatedSocketUser | undefined;
    if (!user) throw new WsException('Unauthorized');
    return user;
  }
}
