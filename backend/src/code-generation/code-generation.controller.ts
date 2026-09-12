import { Controller, Post, Get, Param, UseGuards, Request, Res } from '@nestjs/common';
import { Response } from 'express';
import { CodeGenerationService } from './code-generation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import * as fs from 'fs';
import * as path from 'path';

@Controller('code-generation')
@UseGuards(JwtAuthGuard)
export class CodeGenerationController {
  constructor(private codeGenerationService: CodeGenerationService) {}

  @Post('spring-boot/:diagramId')
  async generateSpringBoot(
    @Param('diagramId') diagramId: string,
    @Request() req,
  ) {
    return this.codeGenerationService.generateSpringBootProject(
      diagramId,
      req.user.userId,
    );
  }

  @Get('download/:generatedCodeId')
  async downloadProject(
    @Param('generatedCodeId') generatedCodeId: string,
    @Request() req,
    @Res() res: Response,
  ) {
    const download = await this.codeGenerationService.downloadProject(
      generatedCodeId,
      req.user.userId,
    );

    if (download.kind === 'legacy') {
      if (!fs.existsSync(download.zipPath)) {
        return res.status(404).json({
          success: false,
          error: 'Generated project file not found',
        });
      }
      const fileName = path.basename(download.zipPath);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      const fileStream = fs.createReadStream(download.zipPath);
      fileStream.pipe(res);
      return;
    }

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      void download.cleanup();
    };
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${download.filename}"`,
    );
    res.on('finish', cleanup);
    res.on('close', cleanup);
    res.on('error', cleanup);
    download.stream.pipe(res);
  }

  @Post('flutter/:diagramId')
  async generateFlutter(
    @Param('diagramId') diagramId: string,
    @Request() req,
  ) {
    return this.codeGenerationService.generateFlutterProject(
      diagramId,
      req.user.userId,
    );
  }

  @Get('projects')
  async getGeneratedProjects(@Request() req) {
    const projects = await this.codeGenerationService.getGeneratedProjects(
      req.user.userId,
    );
    return { success: true, projects };
  }
}
