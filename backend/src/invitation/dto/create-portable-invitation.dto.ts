import { Role } from '@prisma/client';
import { IsEmail, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreatePortableInvitationDto {
  @IsEnum(Role)
  role: Role = Role.VIEWER;

  @IsInt()
  @Min(1)
  @Max(720)
  @IsOptional()
  expiresInHours?: number;

  @IsEmail()
  @IsOptional()
  email?: string;
}
