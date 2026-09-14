'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import ThemeToggle from '@/components/theme/ThemeToggle';
import LanguageToggle from '@/components/i18n/LanguageToggle';
import { useI18n } from '@/components/i18n/I18nProvider';
import { WorkspaceSort } from '@/types/workspace';

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { workspaces, fetchWorkspaces, createWorkspace, isLoading } = useWorkspaceStore();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [isCreating, setIsCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<WorkspaceSort>('updated_desc');
  const { t } = useI18n();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    const timer = window.setTimeout(() => {
      void fetchWorkspaces({ search, sort });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [user, router, fetchWorkspaces, search, sort]);

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
      alert(t('workspaceForm.createError'));
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
        <span className="sr-only">{t('common.loading')}</span>
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
                {t('dashboard.title')}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {t('dashboard.welcomeBack', { name: user.name })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <LanguageToggle />
              <ThemeToggle />
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                {t('dashboard.logout')}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6 grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-[1fr_auto]">
            <div>
              <label htmlFor="project-search" className="sr-only">{t('dashboard.search')}</label>
              <input
                id="project-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('dashboard.searchPlaceholder')}
                className="w-full min-h-11 rounded-md border border-input bg-background px-3 text-foreground"
              />
            </div>
            <div>
              <label htmlFor="project-sort" className="sr-only">{t('dashboard.sort.label')}</label>
              <select
                id="project-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value as WorkspaceSort)}
                className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-foreground sm:w-auto"
              >
                <option value="updated_desc">{t('dashboard.sort.updatedDesc')}</option>
                <option value="updated_asc">{t('dashboard.sort.updatedAsc')}</option>
                <option value="name_asc">{t('dashboard.sort.nameAsc')}</option>
                <option value="name_desc">{t('dashboard.sort.nameDesc')}</option>
              </select>
            </div>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <span className="sr-only">{t('common.loading')}</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Owned Workspaces */}
              <div className="bg-card overflow-hidden border border-border shadow-sm rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      {t('dashboard.myWorkspaces')}
                    </h3>
                    {workspaces.owned.length > 0 && (
                      <button
                        onClick={openCreateModal}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-2"
                      >
                        <Plus size={16} />
                        <span>{t('dashboard.newWorkspace')}</span>
                      </button>
                    )}
                  </div>
                  <div className="mt-5">
                    {workspaces.owned.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500">{t('dashboard.emptyOwned')}</p>
                        <button
                          onClick={openCreateModal}
                          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium inline-flex items-center space-x-2"
                        >
                          <Plus size={16} />
                          <span>{t('dashboard.createFirst')}</span>
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
                              <span>{t(workspace._count.diagrams === 1 ? 'dashboard.diagramCountOne' : 'dashboard.diagramCount', { count: workspace._count.diagrams })}</span>
                              <span className="mx-2">•</span>
                              <span>{t(workspace._count.collaborators === 1 ? 'dashboard.collaboratorCountOne' : 'dashboard.collaboratorCount', { count: workspace._count.collaborators })}</span>
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
                    {t('dashboard.sharedWithMe')}
                  </h3>
                  <div className="mt-5">
                    {workspaces.collaborated.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500">{t('dashboard.emptyShared')}</p>
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
                                {t('dashboard.collaborator')}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500">
                              {workspace.description}
                            </p>
                            <div className="mt-2 flex items-center text-xs text-gray-400">
                              <span>{t('dashboard.owner', { name: workspace.owner.name })}</span>
                              <span className="mx-2">•</span>
                              <span>{t(workspace._count.diagrams === 1 ? 'dashboard.diagramCountOne' : 'dashboard.diagramCount', { count: workspace._count.diagrams })}</span>
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
              <h3 className="text-lg font-medium text-gray-900">{t('workspaceForm.title')}</h3>
              <button
                onClick={closeCreateModal}
                aria-label={t('common.close')}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateWorkspace}>
              <div className="mb-4">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('workspaceForm.name')} *
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t('workspaceForm.namePlaceholder')}
                  required
                />
              </div>

              <div className="mb-6">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('workspaceForm.description')}
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t('workspaceForm.descriptionPlaceholder')}
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!formData.name.trim() || isCreating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isCreating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>{t('workspaceForm.creating')}</span>
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      <span>{t('workspaceForm.create')}</span>
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
