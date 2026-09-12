export type RepositoryProjectType = 'SPRING_BOOT' | 'FLUTTER';
export type RevisionStatus = 'CREATING' | 'PUBLISHED' | 'FAILED';

export interface RevisionSummary {
  id: string;
  workspaceId: string;
  diagramId: string;
  modelVersion: number;
  authorId: string;
  projectType: RepositoryProjectType;
  generator: string;
  status: RevisionStatus;
  parentRevisionId: string | null;
  restoredFromId: string | null;
  manifest: { fileCount?: number; totalBytes?: number };
  createdAt: string;
  publishedAt: string | null;
  fileCount: number;
  commentCount: number;
}

export interface RevisionFile {
  id: string;
  revisionId: string;
  path: string;
  checksum: string;
  size: number;
  mimeType: string;
  isBinary: boolean;
  createdAt: string;
}

export interface RevisionFileContent extends RevisionFile {
  content?: string;
}

export type RevisionDiffKind =
  | 'ADDED'
  | 'REMOVED'
  | 'MODIFIED'
  | 'UNCHANGED'
  | 'BINARY_MODIFIED';

export interface RevisionFileDiff {
  path: string;
  kind: RevisionDiffKind;
  base?: Pick<RevisionFile, 'id' | 'checksum' | 'size' | 'mimeType' | 'isBinary'>;
  target?: Pick<RevisionFile, 'id' | 'checksum' | 'size' | 'mimeType' | 'isBinary'>;
  patch?: string;
}

export interface RevisionComparison {
  baseRevisionId: string;
  targetRevisionId: string;
  files: RevisionFileDiff[];
}

export interface ReviewComment {
  id: string;
  revisionId: string;
  fileId: string;
  authorId: string;
  line?: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; avatar?: string | null };
}

export interface RepositoryFileNode {
  kind: 'file';
  name: string;
  path: string;
  file: RevisionFile;
}

export interface RepositoryDirectoryNode {
  kind: 'directory';
  name: string;
  path: string;
  children: RepositoryTreeNode[];
}

export type RepositoryTreeNode = RepositoryFileNode | RepositoryDirectoryNode;
