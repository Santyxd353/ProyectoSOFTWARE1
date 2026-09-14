import { Module } from '@nestjs/common';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';
import { PrismaModule } from '../prisma/prisma.module';
import { DiagramModule } from '../diagram/diagram.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { CodeGenerationModule } from '../code-generation/code-generation.module';
import { BackendRefinementService } from './backend-refinement.service';

@Module({
  imports: [PrismaModule, DiagramModule, AuthorizationModule, CodeGenerationModule],
  controllers: [AiChatController],
  providers: [AiChatService, BackendRefinementService],
  exports: [AiChatService, BackendRefinementService],
})
export class AiChatModule {}
