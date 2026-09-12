import { Role } from '@prisma/client';

export type WorkspaceCapability =
  | 'repository:read'
  | 'repository:generate'
  | 'repository:restore'
  | 'comment:create'
  | 'members:manage'
  | 'policy:manage';

export interface WorkspaceAccess {
  workspaceId: string;
  userId: string;
  role: Role;
  allowViewerComments: boolean;
}
