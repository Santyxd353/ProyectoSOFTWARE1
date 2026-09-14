import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../prisma/prisma.module';
import { InvitationService } from './invitation.service';

@Module({
  imports: [PrismaModule, AuthorizationModule, AuditModule],
  providers: [InvitationService],
  exports: [InvitationService],
})
export class InvitationModule {}
