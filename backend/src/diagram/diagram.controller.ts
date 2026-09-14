import { Controller, Get, Post, Put, Delete, Body, Param, Query, Res, UseGuards, Request } from '@nestjs/common';
import { DiagramService } from './diagram.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IsNotEmpty, IsString, IsObject, IsOptional, IsInt, Min, MaxLength } from 'class-validator';
import { Response } from 'express';
import { DiagramInterchangeService } from '../diagram-interchange/diagram-interchange.service';
import { CollaborationOperationService } from '../collaboration/collaboration-operation.service';

class CreateDiagramDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  workspaceId: string;
}

class UpdateDiagramDto {
  @IsObject()
  data: any;
}

class AddClassDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsObject()
  @IsOptional()
  position?: { x: number; y: number };

  @IsOptional()
  attributes?: any[];

  @IsOptional()
  methods?: any[];
}

@Controller('diagrams')
@UseGuards(JwtAuthGuard)
export class DiagramController {
  constructor(
    private diagramService: DiagramService,
    private readonly interchange: DiagramInterchangeService,
    private readonly operations: CollaborationOperationService,
  ) {}

  @Post()
  async createDiagram(@Body() createDiagramDto: CreateDiagramDto, @Request() req) {
    return this.diagramService.createDiagram(
      createDiagramDto.workspaceId,
      req.user.userId,
      createDiagramDto.name,
    );
  }

  @Get(':id')
  async getDiagramById(@Param('id') id: string, @Request() req) {
    return this.diagramService.getDiagramById(id, req.user.userId);
  }

  @Get(':id/export/xmi')
  async exportXmi(
    @Param('id') id: string,
    @Request() req,
    @Res({ passthrough: true }) response: Response,
  ) {
    const diagram = await this.diagramService.getDiagramById(id, req.user.userId);
    const xmi = await this.interchange.exportXmi(id, req.user.userId);
    const filename = `${diagram.name.replace(/[^A-Za-z0-9._-]/g, '_') || 'diagram'}.xmi`;
    response.type('application/xml; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return xmi;
  }

  @Post('import/xmi')
  importXmi(@Body() body: ImportXmiDto, @Request() req) {
    return this.interchange.importXmi(
      body.workspaceId,
      req.user.userId,
      body.name,
      body.xmi,
    );
  }

  @Put(':id')
  async updateDiagram(
    @Param('id') id: string,
    @Body() updateDiagramDto: UpdateDiagramDto,
    @Request() req,
  ) {
    return this.diagramService.updateDiagram(id, req.user.userId, updateDiagramDto.data);
  }

  @Post(':id/classes')
  async addUMLClass(
    @Param('id') id: string,
    @Body() addClassDto: AddClassDto,
    @Request() req,
  ) {
    return this.diagramService.addUMLClass(id, req.user.userId, addClassDto);
  }

  @Delete(':id')
  async deleteDiagram(@Param('id') id: string, @Request() req) {
    return this.diagramService.deleteDiagram(id, req.user.userId);
  }

  @Post(':id/operations')
  applyOperation(
    @Param('id') id: string,
    @Body() body: ApplyDiagramOperationDto,
    @Request() req,
  ) {
    return this.operations.apply({
      diagramId: id,
      userId: req.user.userId,
      deviceId: body.deviceId,
      clientSequence: body.clientSequence,
      baseVersion: body.baseVersion,
      baseData: body.baseData,
      changes: body.changes as any,
    });
  }

  @Get(':id/operations')
  replayOperations(
    @Param('id') id: string,
    @Query('after') after: string | undefined,
    @Request() req,
  ) {
    return this.operations.eventsAfter(
      id,
      req.user.userId,
      Number(after ?? 0),
    );
  }

  @Get(':id/conflicts')
  listConflicts(@Param('id') id: string, @Request() req) {
    return this.operations.listConflicts(id, req.user.userId);
  }

  @Post('conflicts/:conflictId/resolve')
  resolveConflict(
    @Param('conflictId') conflictId: string,
    @Body() body: ResolveConflictDto,
    @Request() req,
  ) {
    return this.operations.resolveConflict(
      conflictId,
      req.user.userId,
      body.resolution,
    );
  }

  @Post(':id/archive')
  async archiveDiagram(@Param('id') id: string, @Request() req) {
    return this.diagramService.archiveDiagram(id, req.user.userId);
  }

  @Post(':id/restore')
  async restoreDiagram(@Param('id') id: string, @Request() req) {
    return this.diagramService.restoreDiagram(id, req.user.userId);
  }
}

class ImportXmiDto {
  @IsString()
  @IsNotEmpty()
  workspaceId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  xmi: string;
}

class ApplyDiagramOperationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  deviceId: string;

  @IsInt()
  @Min(1)
  clientSequence: number;

  @IsInt()
  @Min(1)
  baseVersion: number;

  @IsObject()
  @IsOptional()
  baseData?: Record<string, unknown>;

  @IsObject()
  changes: Record<string, unknown>;
}

class ResolveConflictDto {
  @IsObject()
  resolution: Record<string, unknown>;
}
