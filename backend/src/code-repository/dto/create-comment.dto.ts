import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  fileId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  line?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  body: string;
}
