import { IsIn } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateMemberDto {
  @IsIn([Role.EDITOR, Role.VIEWER])
  role: Role;
}
