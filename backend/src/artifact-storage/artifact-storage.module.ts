import { Module } from '@nestjs/common';
import {
  ARTIFACT_STORAGE,
} from './artifact-storage';
import { LocalArtifactStorage } from './local-artifact-storage.service';
import { ProjectFileScanner } from './project-file-scanner';

@Module({
  providers: [
    LocalArtifactStorage,
    ProjectFileScanner,
    {
      provide: ARTIFACT_STORAGE,
      useExisting: LocalArtifactStorage,
    },
  ],
  exports: [ARTIFACT_STORAGE, ProjectFileScanner],
})
export class ArtifactStorageModule {}
