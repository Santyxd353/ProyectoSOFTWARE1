import { User } from './auth';
import { Diagram } from './uml';

export enum Role {
  OWNER = 'OWNER',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
}

export interface Workspace {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  owner: User;
  currentUserRole: Role;
  allowViewerComments: boolean;
  collaborators: WorkspaceCollaborator[];
  diagrams?: Diagram[];
  _count: {
    collaborators: number;
    diagrams: number;
  };
}

export interface WorkspaceCollaborator {
  id: string;
  role: Role;
  joinedAt: string;
  user: User;
}

export interface CreateWorkspaceData {
  name: string;
  description?: string;
}

export interface WorkspaceMember {
  id: string;
  userId: string;
  role: Role;
  joinedAt: string | null;
  user: User;
}

export interface WorkspaceMembersResponse {
  workspaceId: string;
  currentUserRole: Role;
  allowViewerComments: boolean;
  members: WorkspaceMember[];
}
