import { IsNotEmpty, IsString } from 'class-validator';

export class TransferOwnershipDto {
  @IsString()
  @IsNotEmpty()
  memberId: string;

  @IsString()
  confirmationName: string;
}
