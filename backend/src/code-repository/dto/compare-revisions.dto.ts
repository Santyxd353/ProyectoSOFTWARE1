import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CompareRevisionsDto {
  @IsString()
  @IsNotEmpty()
  base: string;

  @IsString()
  @IsNotEmpty()
  target: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  fileId?: string;
}
