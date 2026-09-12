import {
  Prisma,
  ProjectType,
  RevisionStatus,
} from '@prisma/client';

export interface PublishGeneratedProjectInput {
  workspaceId: string;
  diagramId: string;
  modelVersion: number;
  authorId: string;
  projectType: ProjectType;
  generator: string;
  rootPath: string;
}

export interface RevisionSummaryDto {
  id: string;
  workspaceId: string;
  diagramId: string;
  modelVersion: number;
  authorId: string;
  projectType: ProjectType;
  generator: string;
  status: RevisionStatus;
  parentRevisionId: string | null;
  restoredFromId: string | null;
  manifest: Prisma.JsonValue;
  createdAt: Date;
  publishedAt: Date | null;
  fileCount: number;
  commentCount: number;
}
