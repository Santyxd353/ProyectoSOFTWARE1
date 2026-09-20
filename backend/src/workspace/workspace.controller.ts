import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { Role } from '@prisma/client';
import { UpdateMemberDto } from './dto/update-member.dto';
import { UpdateRepositoryPolicyDto } from './dto/update-repository-policy.dto';
import { InvitationService } from '../invitation/invitation.service';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { TransferOwnershipDto } from './dto/transfer-ownership.dto';
import { CreatePortableInvitationDto } from '../invitation/dto/create-portable-invitation.dto';
import { ClaimPortableInvitationDto } from '../invitation/dto/claim-portable-invitation.dto';

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
  constructor(
    private workspaceService: WorkspaceService,
    private readonly invitations: InvitationService,
  ) {}

  @Post()
  async createWorkspace(@Body() createWorkspaceDto: CreateWorkspaceDto, @Request() req) {
    return this.workspaceService.createWorkspace(
      req.user.userId,
      createWorkspaceDto.name,
      createWorkspaceDto.description,
    );
  }

  @Get()
  async getUserWorkspaces(
    @Request() req,
    @Query('search') search?: string,
    @Query('sort') sort?: 'updated_desc' | 'updated_asc' | 'name_asc' | 'name_desc',
  ) {
    return this.workspaceService.getUserWorkspaces(req.user.userId, { search, sort });
  }

  @Patch(':id')
  updateWorkspace(
    @Param('id') id: string,
    @Body() body: UpdateWorkspaceDto,
    @Request() req,
  ) {
    return this.workspaceService.updateWorkspace(id, req.user.userId, body);
  }

  @Post(':id/transfer-ownership')
  transferOwnership(
    @Param('id') id: string,
    @Body() body: TransferOwnershipDto,
    @Request() req,
  ) {
    return this.workspaceService.transferOwnership(
      id,
      req.user.userId,
      body.memberId,
      body.confirmationName,
    );
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
    return this.invitations.invite(
      id,
      req.user.userId,
      addCollaboratorDto.email,
      addCollaboratorDto.role ?? Role.VIEWER,
    );
  }

  @Post(':id/invitations')
  invite(
    @Param('id') id: string,
    @Body() body: AddCollaboratorDto,
    @Request() req,
  ) {
    return this.invitations.invite(
      id,
      req.user.userId,
      body.email,
      body.role ?? Role.VIEWER,
    );
  }

  @Post(':id/invitations/portable')
  createPortableInvitation(
    @Param('id') id: string,
    @Body() body: CreatePortableInvitationDto,
    @Request() req,
  ) {
    return this.invitations.createPortable(
      id,
      req.user.userId,
      body.role ?? Role.VIEWER,
      body.expiresInHours,
      body.email,
    );
  }

  @Post('invitations/claim')
  claimPortableInvitation(
    @Body() body: ClaimPortableInvitationDto,
    @Request() req,
  ) {
    return this.invitations.claimPortable(req.user.userId, body.secret);
  }

  @Get(':id/invitations')
  listInvitations(@Param('id') id: string, @Request() req) {
    return this.invitations.list(id, req.user.userId);
  }

  @Delete(':id/invitations/:invitationId')
  revokeInvitation(
    @Param('id') id: string,
    @Param('invitationId') invitationId: string,
    @Request() req,
  ) {
    return this.invitations.revoke(id, req.user.userId, invitationId);
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
