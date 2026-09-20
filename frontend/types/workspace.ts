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
  archivedDiagrams?: Diagram[];
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

export type WorkspaceSort = 'updated_desc' | 'updated_asc' | 'name_asc' | 'name_desc';

export interface WorkspaceQuery {
  search?: string;
  sort?: WorkspaceSort;
}

export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  email: string | null;
  role: Role.EDITOR | Role.VIEWER;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED';
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PortableInvitationResult {
  kind: 'portable';
  invitation: WorkspaceInvitation;
  token: string;
  code: string;
  url: string;
}

export type InviteResult =
  | { kind: 'member'; member: WorkspaceCollaborator }
  | { kind: 'invitation'; invitation: WorkspaceInvitation };
