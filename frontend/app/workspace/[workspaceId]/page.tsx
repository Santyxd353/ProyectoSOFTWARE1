'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Users, Calendar, FileText, ArrowLeft, Settings, Share, X, Trash2, Code2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { diagramAPI } from '@/lib/api';
import { Diagram } from '@/types/uml';
import { workspaceAPI } from '@/lib/api';
import ThemeToggle from '@/components/theme/ThemeToggle';
import CodeRepositoryPanel from '@/components/repository/CodeRepositoryPanel';
import MemberManagement from '@/components/workspace/MemberManagement';
import { Role } from '@/types/workspace';

interface WorkspacePageProps {
  params: {
    workspaceId: string;
  };
}

export default function WorkspacePage({ params }: WorkspacePageProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { currentWorkspace, fetchWorkspaceById, isLoading } = useWorkspaceStore();
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [isCreatingDiagram, setIsCreatingDiagram] = useState(false);
  const [newDiagramName, setNewDiagramName] = useState('');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [collaboratorEmail, setCollaboratorEmail] = useState('');
  const [collaboratorRole, setCollaboratorRole] = useState<'EDITOR' | 'VIEWER'>('VIEWER');
  const [isInviting, setIsInviting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [diagramToDelete, setDiagramToDelete] = useState<Diagram | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<'diagrams' | 'code' | 'members'>('diagrams');

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    fetchWorkspaceById(params.workspaceId);
  }, [params.workspaceId, user, router, fetchWorkspaceById]);

  useEffect(() => {
    if (currentWorkspace?.diagrams) {
      // Ensure all diagrams have the required data structure
      const validDiagrams = currentWorkspace.diagrams.map(diagram => ({
        ...diagram,
        data: diagram.data || { classes: [], relations: [] }
      }));
      setDiagrams(validDiagrams);
    }
  }, [currentWorkspace]);

  const handleCreateDiagram = async () => {
    if (!newDiagramName.trim() || !user) return;

    try {
      setIsCreatingDiagram(true);
      const newDiagram = await diagramAPI.createDiagram(params.workspaceId, newDiagramName);
      setDiagrams(prev => [newDiagram, ...prev]);
      setNewDiagramName('');

      // Navigate to the new diagram
      router.push(`/workspace/${params.workspaceId}/diagram/${newDiagram.id}`);
    } catch (error: any) {
      console.error('Error creating diagram:', error);
      alert(error.response?.data?.message || 'Failed to create diagram');
    } finally {
      setIsCreatingDiagram(false);
    }
  };

  const handleDiagramClick = (diagramId: string) => {
    router.push(`/workspace/${params.workspaceId}/diagram/${diagramId}`);
  };

  const handleInviteCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collaboratorEmail.trim()) return;

    try {
      setIsInviting(true);
      await workspaceAPI.addCollaborator(params.workspaceId, collaboratorEmail, collaboratorRole);

      // Refresh workspace data
      await fetchWorkspaceById(params.workspaceId);

      // Close modal and reset form
      setIsShareModalOpen(false);
      setCollaboratorEmail('');
      setCollaboratorRole('VIEWER');

      alert('Colaborador invitado exitosamente');
    } catch (error: any) {
      console.error('Error inviting collaborator:', error);
      alert(error.response?.data?.message || 'Error al invitar colaborador');
    } finally {
      setIsInviting(false);
    }
  };

  const handleDeleteDiagram = async () => {
    if (!diagramToDelete) return;

    try {
      setIsDeleting(true);
      await diagramAPI.deleteDiagram(diagramToDelete.id);

      // Remove from local state
      setDiagrams(prev => prev.filter(d => d.id !== diagramToDelete.id));

      // Close modal
      setIsDeleteModalOpen(false);
      setDiagramToDelete(null);

      alert('Diagrama eliminado exitosamente');
    } catch (error: any) {
      console.error('Error deleting diagram:', error);
      alert(error.response?.data?.message || 'Error al eliminar diagrama');
    } finally {
      setIsDeleting(false);
    }
  };

  const openDeleteModal = (diagram: Diagram, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setDiagramToDelete(diagram);
    setIsDeleteModalOpen(true);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isLoading || !currentWorkspace) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Workspace</h2>
          <p className="text-gray-600">Please wait while we load your workspace...</p>
        </div>
      </div>
    );
  }

  const currentRole = currentWorkspace.currentUserRole ?? (
    currentWorkspace.owner.id === user.id ? Role.OWNER : Role.VIEWER
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft size={20} />
                <span>Dashboard</span>
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{currentWorkspace.name}</h1>
                <p className="text-gray-600">{currentWorkspace.description}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <ThemeToggle />
              {currentRole === Role.OWNER && (
                <button
                  onClick={() => setIsShareModalOpen(true)}
                  className="flex min-h-11 items-center space-x-2 rounded-md bg-primary px-4 text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Share size={16} />
                  <span>Compartir</span>
                </button>
              )}
              <button onClick={() => setActiveTab('members')} className="flex min-h-11 items-center space-x-2 rounded-md bg-gray-100 px-4 text-gray-700 hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Settings size={16} />
                <span>Configuración</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <nav className="mb-6 flex flex-wrap gap-2 border-b border-border" aria-label="Secciones del proyecto">
            {[
              { id: 'diagrams' as const, label: 'Diagramas', icon: FileText },
              { id: 'code' as const, label: 'Código', icon: Code2 },
              { id: 'members' as const, label: 'Miembros', icon: Users },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                aria-current={activeTab === id ? 'page' : undefined}
                className={`flex min-h-11 cursor-pointer items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  activeTab === id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
                }`}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
          </nav>

          {activeTab === 'diagrams' && (
          <div>
          {/* Workspace Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-card overflow-hidden border border-border shadow-sm rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <FileText className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Diagrams</dt>
                      <dd className="text-lg font-medium text-gray-900">{diagrams.length}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card overflow-hidden border border-border shadow-sm rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Users className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Collaborators</dt>
                      <dd className="text-lg font-medium text-gray-900">{currentWorkspace.collaborators.length + 1}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card overflow-hidden border border-border shadow-sm rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Calendar className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Created</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {new Date(currentWorkspace.createdAt).toLocaleDateString()}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Create New Diagram */}
          <div className="bg-card border border-border shadow-sm rounded-lg mb-8">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Create New Diagram
              </h3>
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={newDiagramName}
                  onChange={(e) => setNewDiagramName(e.target.value)}
                  placeholder="Enter diagram name..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateDiagram()}
                />
                <button
                  onClick={handleCreateDiagram}
                  disabled={!newDiagramName.trim() || isCreatingDiagram}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isCreatingDiagram ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Plus size={16} />
                  )}
                  <span>Create Diagram</span>
                </button>
              </div>
            </div>
          </div>

          {/* Diagrams List */}
          <div className="bg-card border border-border shadow-sm rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                UML Diagrams
              </h3>

              {diagrams.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No diagrams</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Get started by creating your first UML diagram.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {diagrams.map((diagram) => (
                    <div
                      key={diagram.id}
                      onClick={() => handleDiagramClick(diagram.id)}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors relative group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900 truncate pr-8">{diagram.name}</h4>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500">v{diagram.version}</span>
                          <button
                            onClick={(e) => openDeleteModal(diagram, e)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 rounded"
                            title="Eliminar diagrama"
                          >
                            <Trash2 size={16} className="text-red-600" />
                          </button>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 mb-3">
                        {diagram.data?.classes?.length || 0} classes •{' '}
                        {diagram.data?.relations?.length || 0} relations
                      </div>
                      <div className="text-xs text-gray-400">
                        Updated {new Date(diagram.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Collaborators */}
          {currentWorkspace.collaborators.length > 0 && (
            <div className="bg-card border border-border shadow-sm rounded-lg mt-8">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Collaborators
                </h3>
                <div className="space-y-3">
                  {/* Owner */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-white">
                          {currentWorkspace.owner.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{currentWorkspace.owner.name}</p>
                        <p className="text-xs text-gray-500">{currentWorkspace.owner.email}</p>
                      </div>
                    </div>
                    <span className="text-xs text-blue-600 font-medium">Owner</span>
                  </div>

                  {/* Collaborators */}
                  {currentWorkspace.collaborators.map((collaborator) => (
                    <div key={collaborator.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 bg-gray-400 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-white">
                            {collaborator.user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{collaborator.user.name}</p>
                          <p className="text-xs text-gray-500">{collaborator.user.email}</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-600 font-medium capitalize">{collaborator.role.toLowerCase()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          </div>
          )}

          {activeTab === 'code' && (
            <CodeRepositoryPanel
              workspaceId={params.workspaceId}
              role={currentRole}
              allowViewerComments={currentWorkspace.allowViewerComments}
            />
          )}

          {activeTab === 'members' && (
            <MemberManagement
              workspaceId={params.workspaceId}
              role={currentRole}
              onWorkspaceChanged={() => fetchWorkspaceById(params.workspaceId)}
            />
          )}
        </div>
      </main>

      {/* Invite Collaborator Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative bg-card border border-border rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Invitar Colaborador</h3>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleInviteCollaborator} className="p-6">
              <div className="mb-4">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email del colaborador *
                </label>
                <input
                  type="email"
                  id="email"
                  value={collaboratorEmail}
                  onChange={(e) => setCollaboratorEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"
                  placeholder="colaborador@ejemplo.com"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  El usuario debe estar registrado en la plataforma
                </p>
              </div>

              <div className="mb-6">
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                  Rol
                </label>
                <select
                  id="role"
                  value={collaboratorRole}
                  onChange={(e) => setCollaboratorRole(e.target.value as 'EDITOR' | 'VIEWER')}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-500">
                  <option value="VIEWER">Viewer (Solo lectura)</option>
                  <option value="EDITOR">Editor (Puede editar)</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!collaboratorEmail.trim() || isInviting}
                  className="px-4 py-2 bg-gray-600 text-white rounded text-sm font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2">
                  {isInviting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Invitando...</span>
                    </>
                  ) : (
                    <span>Invitar</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Diagram Confirmation Modal */}
      {isDeleteModalOpen && diagramToDelete && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative bg-card border border-border rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Confirmar Eliminación</h3>
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                disabled={isDeleting}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="flex-shrink-0">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                    <Trash2 className="h-6 w-6 text-red-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-700">
                    ¿Estás seguro de que deseas eliminar el diagrama{' '}
                    <span className="font-semibold">"{diagramToDelete.name}"</span>?
                  </p>
                  <p className="mt-2 text-sm text-red-600">
                    Esta acción no se puede deshacer.
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteDiagram}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isDeleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Eliminando...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      <span>Eliminar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
