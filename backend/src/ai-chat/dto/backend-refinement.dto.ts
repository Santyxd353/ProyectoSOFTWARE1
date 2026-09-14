import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ProposeBackendRefinementDto {
  @IsString()
  @IsNotEmpty()
  diagramId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  instruction: string;
}

export class ConfirmBackendRefinementDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
