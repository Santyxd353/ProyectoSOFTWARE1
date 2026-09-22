import { ArrayNotEmpty, IsArray, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

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

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  selectedFeatures?: string[];
}
