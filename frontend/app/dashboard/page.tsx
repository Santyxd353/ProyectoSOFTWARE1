'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import ThemeToggle from '@/components/theme/ThemeToggle';

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { workspaces, fetchWorkspaces, createWorkspace, isLoading } = useWorkspaceStore();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    fetchWorkspaces();
  }, [user, router, fetchWorkspaces]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsCreating(true);
    try {
      const newWorkspace = await createWorkspace(formData);
      setIsCreateModalOpen(false);
      setFormData({ name: '', description: '' });
      // Redirect to the new workspace
      router.push(`/workspace/${newWorkspace.id}`);
    } catch (error) {
      console.error('Error creating workspace:', error);
      alert('Failed to create workspace. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const openCreateModal = () => {
    setIsCreateModalOpen(true);
    setFormData({ name: '', description: '' });
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setFormData({ name: '', description: '' });
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                UML Platform Dashboard
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Welcome back, {user.name}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Owned Workspaces */}
              <div className="bg-card overflow-hidden border border-border shadow-sm rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      My Workspaces
                    </h3>
                    {workspaces.owned.length > 0 && (
                      <button
                        onClick={openCreateModal}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-2"
                      >
                        <Plus size={16} />
                        <span>New Workspace</span>
                      </button>
                    )}
                  </div>
                  <div className="mt-5">
                    {workspaces.owned.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No workspaces yet</p>
                        <button
                          onClick={openCreateModal}
                          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium inline-flex items-center space-x-2"
                        >
                          <Plus size={16} />
                          <span>Create Your First Workspace</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {workspaces.owned.map((workspace) => (
                          <div
                            key={workspace.id}
                            onClick={() => router.push(`/workspace/${workspace.id}`)}
                            className="border border-gray-200 rounded-md p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                          >
                            <h4 className="font-medium text-gray-900">
                              {workspace.name}
                            </h4>
                            <p className="text-sm text-gray-500">
                              {workspace.description}
                            </p>
                            <div className="mt-2 flex items-center text-xs text-gray-400">
                              <span>{workspace._count.diagrams} diagrams</span>
                              <span className="mx-2">•</span>
                              <span>{workspace._count.collaborators} collaborators</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Collaborated Workspaces */}
              <div className="bg-card overflow-hidden border border-border shadow-sm rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Shared with Me
                  </h3>
                  <div className="mt-5">
                    {workspaces.collaborated.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No shared workspaces</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {workspaces.collaborated.map((workspace) => (
                          <div
                            key={workspace.id}
                            onClick={() => router.push(`/workspace/${workspace.id}`)}
                            className="border border-gray-200 rounded-md p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-gray-900">
                                {workspace.name}
                              </h4>
                              <span className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded">
                                Colaborador
                              </span>
                            </div>
                            <p className="text-sm text-gray-500">
                              {workspace.description}
                            </p>
                            <div className="mt-2 flex items-center text-xs text-gray-400">
                              <span>Propietario: {workspace.owner.name}</span>
                              <span className="mx-2">•</span>
                              <span>{workspace._count.diagrams} diagramas</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Create Workspace Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border border-border w-96 shadow-xl rounded-lg bg-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Create New Workspace</h3>
              <button
                onClick={closeCreateModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateWorkspace}>
              <div className="mb-4">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Workspace Name *
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter workspace name"
                  required
                />
              </div>

              <div className="mb-6">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter workspace description (optional)"
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formData.name.trim() || isCreating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isCreating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      <span>Create Workspace</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
