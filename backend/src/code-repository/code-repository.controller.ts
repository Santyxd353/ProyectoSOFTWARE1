import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CodeRepositoryService } from './code-repository.service';
import { CompareRevisionsDto } from './dto/compare-revisions.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

@Controller('workspaces/:workspaceId/revisions')
@UseGuards(JwtAuthGuard)
export class CodeRepositoryController {
  constructor(private readonly repository: CodeRepositoryService) {}

  @Get()
  list(
    @Param('workspaceId') workspaceId: string,
    @Request() request,
    @Query('diagramId') diagramId?: string,
  ) {
    return this.repository.list(workspaceId, request.user.userId, diagramId);
  }

  @Get('compare')
  compare(
    @Param('workspaceId') workspaceId: string,
    @Request() request,
    @Query() query: CompareRevisionsDto,
  ) {
    return this.repository.compare(
      workspaceId,
      query.base,
      query.target,
      request.user.userId,
      query.fileId,
    );
  }

  @Get(':revisionId')
  get(
    @Param('workspaceId') workspaceId: string,
    @Param('revisionId') revisionId: string,
    @Request() request,
  ) {
    return this.repository.get(workspaceId, revisionId, request.user.userId);
  }

  @Get(':revisionId/tree')
  tree(
    @Param('workspaceId') workspaceId: string,
    @Param('revisionId') revisionId: string,
    @Request() request,
  ) {
    return this.repository.tree(workspaceId, revisionId, request.user.userId);
  }

  @Get(':revisionId/files/:fileId')
  readFile(
    @Param('workspaceId') workspaceId: string,
    @Param('revisionId') revisionId: string,
    @Param('fileId') fileId: string,
    @Request() request,
  ) {
    return this.repository.readFile(
      workspaceId,
      revisionId,
      fileId,
      request.user.userId,
    );
  }

  @Get(':revisionId/download')
  async download(
    @Param('workspaceId') workspaceId: string,
    @Param('revisionId') revisionId: string,
    @Request() request,
    @Res() response: Response,
  ) {
    const download = await this.repository.download(
      workspaceId,
      revisionId,
      request.user.userId,
    );
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      void download.cleanup();
    };
    response.setHeader('Content-Type', 'application/zip');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${download.filename}"`,
    );
    response.on('finish', cleanup);
    response.on('close', cleanup);
    response.on('error', cleanup);
    download.stream.pipe(response);
  }

  @Post(':revisionId/restore')
  restore(
    @Param('workspaceId') workspaceId: string,
    @Param('revisionId') revisionId: string,
    @Request() request,
  ) {
    return this.repository.restore(
      workspaceId,
      revisionId,
      request.user.userId,
    );
  }

  @Get(':revisionId/comments')
  listComments(
    @Param('workspaceId') workspaceId: string,
    @Param('revisionId') revisionId: string,
    @Request() request,
    @Query('fileId') fileId?: string,
  ) {
    return this.repository.listComments(
      workspaceId,
      revisionId,
      request.user.userId,
      fileId,
    );
  }

  @Post(':revisionId/comments')
  createComment(
    @Param('workspaceId') workspaceId: string,
    @Param('revisionId') revisionId: string,
    @Request() request,
    @Body() body: CreateCommentDto,
  ) {
    return this.repository.createComment(
      workspaceId,
      revisionId,
      request.user.userId,
      body,
    );
  }
}
