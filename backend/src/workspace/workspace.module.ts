import { Module } from '@nestjs/common';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuditModule } from '../audit/audit.module';
import { InvitationModule } from '../invitation/invitation.module';
import { CollaborationModule } from '../collaboration/collaboration.module';

@Module({
  imports: [
    PrismaModule,
    AuthorizationModule,
    AuditModule,
    InvitationModule,
    CollaborationModule,
  ],
  controllers: [WorkspaceController],
  providers: [WorkspaceService],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}
