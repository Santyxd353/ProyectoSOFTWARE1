import { Module } from '@nestjs/common';
import { CodeGenerationController } from './code-generation.controller';
import { CodeGenerationService } from './code-generation.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { CodeRepositoryModule } from '../code-repository/code-repository.module';

@Module({
  imports: [PrismaModule, AuthorizationModule, CodeRepositoryModule],
  controllers: [CodeGenerationController],
  providers: [CodeGenerationService],
  exports: [CodeGenerationService],
})
export class CodeGenerationModule {}
