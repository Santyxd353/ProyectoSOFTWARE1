import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { Role } from '@prisma/client';
import { UpdateMemberDto } from './dto/update-member.dto';
import { UpdateRepositoryPolicyDto } from './dto/update-repository-policy.dto';

class CreateWorkspaceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}

class AddCollaboratorDto {
  @IsString()
  @IsNotEmpty()
  email: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role = Role.VIEWER;
}

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspaceController {
  constructor(private workspaceService: WorkspaceService) {}

  @Post()
  async createWorkspace(@Body() createWorkspaceDto: CreateWorkspaceDto, @Request() req) {
    return this.workspaceService.createWorkspace(
      req.user.userId,
      createWorkspaceDto.name,
      createWorkspaceDto.description,
    );
  }

  @Get()
  async getUserWorkspaces(@Request() req) {
    return this.workspaceService.getUserWorkspaces(req.user.userId);
  }

  @Get(':id')
  async getWorkspaceById(@Param('id') id: string, @Request() req) {
    return this.workspaceService.getWorkspaceById(id, req.user.userId);
  }

  @Post(':id/collaborators')
  async addCollaborator(
    @Param('id') id: string,
    @Body() addCollaboratorDto: AddCollaboratorDto,
    @Request() req,
  ) {
    return this.workspaceService.addCollaborator(
      id,
      req.user.userId,
      addCollaboratorDto.email,
      addCollaboratorDto.role,
    );
  }

  @Get(':id/members')
  listMembers(@Param('id') id: string, @Request() req) {
    return this.workspaceService.listMembers(id, req.user.userId);
  }

  @Patch(':id/members/:memberId')
  updateMemberRole(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() body: UpdateMemberDto,
    @Request() req,
  ) {
    return this.workspaceService.updateMemberRole(
      id,
      req.user.userId,
      memberId,
      body.role,
    );
  }

  @Delete(':id/members/:memberId')
  removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Request() req,
  ) {
    return this.workspaceService.removeMember(id, req.user.userId, memberId);
  }

  @Patch(':id/repository-policy')
  updateRepositoryPolicy(
    @Param('id') id: string,
    @Body() body: UpdateRepositoryPolicyDto,
    @Request() req,
  ) {
    return this.workspaceService.updateRepositoryPolicy(
      id,
      req.user.userId,
      body.allowViewerComments,
    );
  }
}
