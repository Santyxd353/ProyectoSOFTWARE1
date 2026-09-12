import { Module } from '@nestjs/common';
import { ArtifactStorageModule } from '../artifact-storage/artifact-storage.module';
import { AuditModule } from '../audit/audit.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CodeRepositoryService } from './code-repository.service';
import { CodeRepositoryController } from './code-repository.controller';

@Module({
  imports: [
    PrismaModule,
    AuthorizationModule,
    AuditModule,
    ArtifactStorageModule,
  ],
  controllers: [CodeRepositoryController],
  providers: [CodeRepositoryService],
  exports: [CodeRepositoryService],
})
export class CodeRepositoryModule {}
