import axios from 'axios';
import { AuthResponse, LoginData, RegisterData } from '@/types/auth';
import { Workspace, CreateWorkspaceData } from '@/types/workspace';
import { Diagram } from '@/types/uml';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (data: LoginData): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', data);
    return response.data;
  },

  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response.data;
  },

  verifyToken: async () => {
    const response = await api.get('/auth/verify');
    return response.data;
  },
};

// Workspace API
export const workspaceAPI = {
  getWorkspaces: async () => {
    const response = await api.get('/workspaces');
    return response.data;
  },

  getWorkspaceById: async (id: string): Promise<Workspace> => {
    const response = await api.get(`/workspaces/${id}`);
    return response.data;
  },

  createWorkspace: async (data: CreateWorkspaceData): Promise<Workspace> => {
    const response = await api.post('/workspaces', data);
    return response.data;
  },

  addCollaborator: async (workspaceId: string, email: string, role?: string) => {
    const response = await api.post(`/workspaces/${workspaceId}/collaborators`, {
      email,
      role,
    });
    return response.data;
  },
};

// Diagram API
export const diagramAPI = {
  getDiagramById: async (id: string): Promise<Diagram> => {
    const response = await api.get(`/diagrams/${id}`);
    return response.data;
  },

  createDiagram: async (workspaceId: string, name: string): Promise<Diagram> => {
    const response = await api.post('/diagrams', { workspaceId, name });
    return response.data;
  },

  updateDiagram: async (id: string, data: any): Promise<Diagram> => {
    const response = await api.put(`/diagrams/${id}`, { data }, {
      timeout: 30000, // 30 segundos para guardado de diagrama
    });
    return response.data;
  },

  addClass: async (diagramId: string, classData: any) => {
    const response = await api.post(`/diagrams/${diagramId}/classes`, classData);
    return response.data;
  },

  deleteDiagram: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/diagrams/${id}`);
    return response.data;
  },
};

// AI Chat API
export const aiAPI = {
  generateUML: async (prompt: string, diagramId: string) => {
    const response = await api.post('/ai-chat/generate-uml', {
      prompt,
      diagramId,
    }, {
      timeout: 60000, // 60 segundos para generación IA
    });
    return response.data;
  },

  chat: async (message: string, diagramId?: string, image?: string) => {
    const response = await api.post('/ai-chat/chat', { message, diagramId, image }, {
      timeout: image ? 180000 : 60000, // 3 minutos para imágenes, 60 segundos para texto
    });
    return response.data;
  },

  getSuggestions: async () => {
    const response = await api.get('/ai-chat/suggestions');
    return response.data;
  },

  getTemplates: async () => {
    const response = await api.get('/ai-chat/templates');
    return response.data;
  },
};

// Code Generation API
export const codeGenAPI = {
  generateSpringBoot: async (diagramId: string) => {
    const response = await api.post(`/code-generation/spring-boot/${diagramId}`, {}, {
      timeout: 60000, // 60 segundos para generación de código
    });
    return response.data;
  },

  generateFlutter: async (diagramId: string) => {
    const response = await api.post(`/code-generation/flutter/${diagramId}`, {}, {
      timeout: 60000, // 60 segundos para generación de código Flutter
    });
    return response.data;
  },

  downloadProject: async (generatedCodeId: string): Promise<Blob> => {
    const response = await api.get(`/code-generation/download/${generatedCodeId}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  getGeneratedProjects: async () => {
    const response = await api.get('/code-generation/projects');
    return response.data;
  },
};

export default api;