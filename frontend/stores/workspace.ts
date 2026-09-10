import { create } from 'zustand';
import { Workspace, CreateWorkspaceData } from '@/types/workspace';
import { workspaceAPI } from '@/lib/api';

interface WorkspaceState {
  workspaces: {
    owned: Workspace[];
    collaborated: Workspace[];
  };
  currentWorkspace: Workspace | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchWorkspaces: () => Promise<void>;
  fetchWorkspaceById: (id: string) => Promise<void>;
  createWorkspace: (data: CreateWorkspaceData) => Promise<Workspace>;
  addCollaborator: (workspaceId: string, email: string, role?: string) => Promise<void>;
  clearError: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: {
    owned: [],
    collaborated: [],
  },
  currentWorkspace: null,
  isLoading: false,
  error: null,

  fetchWorkspaces: async () => {
    set({ isLoading: true, error: null });
    try {
      const workspaces = await workspaceAPI.getWorkspaces();
      set({ workspaces, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch workspaces',
        isLoading: false,
      });
    }
  },

  fetchWorkspaceById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const workspace = await workspaceAPI.getWorkspaceById(id);
      set({ currentWorkspace: workspace, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch workspace',
        isLoading: false,
      });
    }
  },

  createWorkspace: async (data: CreateWorkspaceData) => {
    set({ isLoading: true, error: null });
    try {
      const workspace = await workspaceAPI.createWorkspace(data);

      // Update local state
      const currentWorkspaces = get().workspaces;
      set({
        workspaces: {
          ...currentWorkspaces,
          owned: [workspace, ...currentWorkspaces.owned],
        },
        isLoading: false,
      });

      return workspace;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to create workspace',
        isLoading: false,
      });
      throw error;
    }
  },

  addCollaborator: async (workspaceId: string, email: string, role?: string) => {
    try {
      await workspaceAPI.addCollaborator(workspaceId, email, role);

      // Refresh current workspace if it's the one being updated
      if (get().currentWorkspace?.id === workspaceId) {
        await get().fetchWorkspaceById(workspaceId);
      }
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to add collaborator',
      });
      throw error;
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));