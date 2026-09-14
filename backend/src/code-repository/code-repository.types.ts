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
  manifestMetadata?: Prisma.InputJsonObject;
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

export interface RevisionFileDto {
  id: string;
  revisionId: string;
  path: string;
  checksum: string;
  size: number;
  mimeType: string;
  isBinary: boolean;
  createdAt: Date;
}

export interface RevisionFileContentDto extends RevisionFileDto {
  content?: string;
}

export type RevisionFileDiffKind =
  | 'ADDED'
  | 'REMOVED'
  | 'MODIFIED'
  | 'UNCHANGED'
  | 'BINARY_MODIFIED';

export interface RevisionFileDiffDto {
  path: string;
  kind: RevisionFileDiffKind;
  base?: Pick<RevisionFileDto, 'id' | 'checksum' | 'size' | 'mimeType' | 'isBinary'>;
  target?: Pick<RevisionFileDto, 'id' | 'checksum' | 'size' | 'mimeType' | 'isBinary'>;
  patch?: string;
}

export interface RevisionComparisonDto {
  baseRevisionId: string;
  targetRevisionId: string;
  files: RevisionFileDiffDto[];
}

export interface CreateReviewCommentInput {
  fileId: string;
  line?: number;
  body: string;
}

export interface RevisionDownload {
  stream: NodeJS.ReadableStream;
  filename: string;
  cleanup: () => Promise<void>;
}
