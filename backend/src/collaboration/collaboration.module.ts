import { Module } from '@nestjs/common';
import { CollaborationGateway } from './collaboration.gateway';
import { CollaborationService } from './collaboration.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { SocketAuthService } from './socket-auth.service';
import { RepositoryRealtimeService } from './repository-realtime.service';
import { CollaborationOperationService } from './collaboration-operation.service';

@Module({
  imports: [PrismaModule, AuthModule, AuthorizationModule],
  providers: [
    CollaborationGateway,
    CollaborationService,
    SocketAuthService,
    RepositoryRealtimeService,
    CollaborationOperationService,
  ],
  exports: [
    CollaborationService,
    RepositoryRealtimeService,
    CollaborationOperationService,
  ],
})
export class CollaborationModule {}
