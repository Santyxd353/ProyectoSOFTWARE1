import type { Role } from '../types/workspace.ts';

export interface RepositoryCapabilities {
  canRead: boolean;
  canComment: boolean;
  canRestore: boolean;
  canManageMembers: boolean;
}

export function repositoryCapabilities(
  role: Role | 'OWNER' | 'EDITOR' | 'VIEWER',
  allowViewerComments: boolean,
): RepositoryCapabilities {
  const canEdit = role === 'OWNER' || role === 'EDITOR';
  return {
    canRead: true,
    canComment: canEdit || allowViewerComments,
    canRestore: canEdit,
    canManageMembers: role === 'OWNER',
  };
}
