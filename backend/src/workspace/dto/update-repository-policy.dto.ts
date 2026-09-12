import { IsBoolean } from 'class-validator';

export class UpdateRepositoryPolicyDto {
  @IsBoolean()
  allowViewerComments: boolean;
}
