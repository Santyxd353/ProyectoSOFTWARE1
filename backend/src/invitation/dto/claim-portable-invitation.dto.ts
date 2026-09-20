import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ClaimPortableInvitationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  secret: string;
}
