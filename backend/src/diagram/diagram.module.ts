import { Module } from '@nestjs/common';
import { DiagramController } from './diagram.controller';
import { DiagramService } from './diagram.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { DiagramInterchangeService } from '../diagram-interchange/diagram-interchange.service';
import { CollaborationModule } from '../collaboration/collaboration.module';

@Module({
  imports: [PrismaModule, AuditModule, CollaborationModule],
  controllers: [DiagramController],
  providers: [DiagramService, DiagramInterchangeService],
  exports: [DiagramService],
})
export class DiagramModule {}
