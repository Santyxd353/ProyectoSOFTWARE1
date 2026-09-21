'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Users, Calendar, FileText, ArrowLeft, Settings, Share, X, Archive, RotateCcw, Code2, Upload } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { diagramAPI } from '@/lib/api';
import { Diagram } from '@/types/uml';
import { workspaceAPI } from '@/lib/api';
import ThemeToggle from '@/components/theme/ThemeToggle';
import CodeRepositoryPanel from '@/components/repository/CodeRepositoryPanel';
import MemberManagement from '@/components/workspace/MemberManagement';
import WorkspaceSettings from '@/components/workspace/WorkspaceSettings';
import { Role } from '@/types/workspace';
import LanguageToggle from '@/components/i18n/LanguageToggle';
import { useI18n } from '@/components/i18n/I18nProvider';
import { useAuthHydrated } from '@/hooks/useAuthHydrated';
import { protectedRouteState } from '@/lib/protected-route';
import {
  moveDiagramToArchive,
  normalizeWorkspaceDiagrams,
  restoreDiagramInState,
} from '@/lib/diagram-lifecycle';

interface WorkspacePageProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

interface ImportPreview {
  token: string;
  name: string;
  format: string;
  accepted: { classes: number; relations: number };
  warnings: string[];
  unsupported: string[];
}

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(
      ...Array.from(bytes.subarray(offset, offset + 0x8000)),
    );
  }
  return btoa(binary);
};

export default function WorkspacePage({ params }: WorkspacePageProps) {
  const { workspaceId } = use(params);
  const router = useRouter();
  const { user } = useAuthStore();
  const authState = protectedRouteState(useAuthHydrated(), user);
  const { currentWorkspace, fetchWorkspaceById, isLoading } = useWorkspaceStore();
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [archivedDiagrams, setArchivedDiagrams] = useState<Diagram[]>([]);
  const [isCreatingDiagram, setIsCreatingDiagram] = useState(false);
  const [newDiagramName, setNewDiagramName] = useState('');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [collaboratorEmail, setCollaboratorEmail] = useState('');
  const [collaboratorRole, setCollaboratorRole] = useState<'EDITOR' | 'VIEWER'>('VIEWER');
  const [isInviting, setIsInviting] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [diagramToArchive, setDiagramToArchive] = useState<Diagram | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [restoringDiagramId, setRestoringDiagramId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isConfirmingImport, setIsConfirmingImport] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [activeTab, setActiveTab] = useState<'diagrams' | 'code' | 'members' | 'settings'>('diagrams');
  const { t, formatDate } = useI18n();

  useEffect(() => {
    if (authState === 'redirect') {
      router.replace('/login');
      return;
    }
    if (authState !== 'ready') return;
    fetchWorkspaceById(workspaceId);
  }, [workspaceId, authState, router, fetchWorkspaceById]);

  useEffect(() => {
    if (currentWorkspace) {
      const normalized = normalizeWorkspaceDiagrams(currentWorkspace);
      setDiagrams(normalized.diagrams);
      setArchivedDiagrams(normalized.archivedDiagrams);
    }
  }, [currentWorkspace]);

  const handleCreateDiagram = async () => {
    if (!newDiagramName.trim() || !user) return;

    try {
      setIsCreatingDiagram(true);
      const newDiagram = await diagramAPI.createDiagram(workspaceId, newDiagramName);
      setDiagrams(prev => [newDiagram, ...prev]);
      setNewDiagramName('');

      // Navigate to the new diagram
      router.push(`/workspace/${workspaceId}/diagram/${newDiagram.id}`);
    } catch (error: any) {
      console.error('Error creating diagram:', error);
      alert(error.response?.data?.message || t('workspace.diagram.createError'));
    } finally {
      setIsCreatingDiagram(false);
    }
  };

  const handleDiagramClick = (diagramId: string) => {
    router.push(`/workspace/${workspaceId}/diagram/${diagramId}`);
  };

  const handleInviteCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collaboratorEmail.trim()) return;

    try {
      setIsInviting(true);
      const result = await workspaceAPI.addCollaborator(workspaceId, collaboratorEmail, collaboratorRole);

      // Refresh workspace data
      await fetchWorkspaceById(workspaceId);

      // Close modal and reset form
      setIsShareModalOpen(false);
      setCollaboratorEmail('');
      setCollaboratorRole('VIEWER');

      alert(t(result.kind === 'invitation'
        ? 'workspace.invitations.pendingSuccess'
        : 'workspace.invite.success'));
    } catch (error: any) {
      console.error('Error inviting collaborator:', error);
      alert(error.response?.data?.message || t('workspace.invite.error'));
    } finally {
      setIsInviting(false);
    }
  };

  const handleArchiveDiagram = async () => {
    if (!diagramToArchive) return;

    try {
      setIsArchiving(true);
      await diagramAPI.archiveDiagram(diagramToArchive.id);
      const next = moveDiagramToArchive(diagrams, archivedDiagrams, diagramToArchive.id);
      setDiagrams(next.diagrams);
      setArchivedDiagrams(next.archivedDiagrams);
      setIsArchiveModalOpen(false);
      setDiagramToArchive(null);
      alert(t('workspace.diagram.archiveSuccess'));
    } catch (error: any) {
      console.error('Error archiving diagram:', error);
      alert(error.response?.data?.message || t('workspace.diagram.archiveError'));
    } finally {
      setIsArchiving(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setIsImporting(true);
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (!extension || !['xmi', 'json', 'zip'].includes(extension)) {
        throw new Error(t('interchange.unsupportedFormat'));
      }
      const format = extension as 'xmi' | 'json' | 'zip';
      const content = format === 'zip'
        ? arrayBufferToBase64(await file.arrayBuffer())
        : await file.text();
      const name = file.name.replace(/\.(xmi|json|zip)$/i, '').trim() || 'Imported diagram';
      const preview = await diagramAPI.previewImport(
        workspaceId,
        name,
        format,
        content,
      );
      setImportPreview(preview);
    } catch (error: any) {
      console.error('Error previewing import:', error);
      alert(error.response?.data?.message || t('interchange.importError'));
    } finally {
      setIsImporting(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview) return;
    try {
      setIsConfirmingImport(true);
      const imported = await diagramAPI.confirmImport(importPreview.token);
      setDiagrams((current) => [imported, ...current]);
      setImportPreview(null);
      alert(t('interchange.importSuccess'));
    } catch (error: any) {
      alert(error.response?.data?.message || t('interchange.importError'));
    } finally {
      setIsConfirmingImport(false);
    }
  };

  const handleRestoreDiagram = async (diagramId: string) => {
    try {
      setRestoringDiagramId(diagramId);
      await diagramAPI.restoreDiagram(diagramId);
      const next = restoreDiagramInState(diagrams, archivedDiagrams, diagramId);
      setDiagrams(next.diagrams);
      setArchivedDiagrams(next.archivedDiagrams);
      alert(t('workspace.diagram.restoreSuccess'));
    } catch (error: any) {
      console.error('Error restoring diagram:', error);
      alert(error.response?.data?.message || t('workspace.diagram.restoreError'));
    } finally {
      setRestoringDiagramId(null);
    }
  };

  const openArchiveModal = (diagram: Diagram, e: React.MouseEvent) => {
    e.stopPropagation();
    setDiagramToArchive(diagram);
    setIsArchiveModalOpen(true);
  };

  if (authState !== 'ready' || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        <span className="sr-only">{t('common.loading')}</span>
      </div>
    );
  }

  if (isLoading || !currentWorkspace) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('workspace.loading')}</h2>
          <p className="text-gray-600">{t('workspace.loadingDetail')}</p>
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
                <span>{t('workspace.backToDashboard')}</span>
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{currentWorkspace.name}</h1>
                <p className="text-gray-600">{currentWorkspace.description}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <LanguageToggle />
              <ThemeToggle />
              {currentRole === Role.OWNER && (
                <button
                  onClick={() => setIsShareModalOpen(true)}
                  className="flex min-h-11 items-center space-x-2 rounded-md bg-primary px-4 text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Share size={16} />
                  <span>{t('workspace.share')}</span>
                </button>
              )}
              <button onClick={() => setActiveTab(currentRole === Role.OWNER ? 'settings' : 'members')} className="flex min-h-11 items-center space-x-2 rounded-md bg-gray-100 px-4 text-gray-700 hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Settings size={16} />
                <span>{t('workspace.settings')}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <nav className="mb-6 flex flex-wrap gap-2 border-b border-border" aria-label={t('workspace.sections')}>
            {[
              { id: 'diagrams' as const, label: t('workspace.tabs.diagrams'), icon: FileText },
              { id: 'code' as const, label: t('workspace.tabs.code'), icon: Code2 },
              { id: 'members' as const, label: t('workspace.tabs.members'), icon: Users },
              ...(currentRole === Role.OWNER
                ? [{ id: 'settings' as const, label: t('workspace.settings'), icon: Settings }]
                : []),
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
                      <dt className="text-sm font-medium text-gray-500 truncate">{t('workspace.stats.diagrams')}</dt>
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
                      <dt className="text-sm font-medium text-gray-500 truncate">{t('workspace.stats.collaborators')}</dt>
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
                      <dt className="text-sm font-medium text-gray-500 truncate">{t('workspace.stats.created')}</dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {formatDate(currentWorkspace.createdAt)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Create New Diagram */}
          {currentRole !== Role.VIEWER && (
          <div className="bg-card border border-border shadow-sm rounded-lg mb-8">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                {t('workspace.diagram.new')}
              </h3>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={newDiagramName}
                  onChange={(e) => setNewDiagramName(e.target.value)}
                  placeholder={t('workspace.diagram.namePlaceholder')}
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
                  <span>{isCreatingDiagram ? t('workspace.diagram.creating') : t('workspace.diagram.create')}</span>
                </button>
                <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-muted">
                    <Upload size={16} />
                    {isImporting ? t('interchange.importing') : t('interchange.import')}
                    <input
                      type="file"
                      accept=".xmi,.json,.zip,application/xml,text/xml,application/json,application/zip"
                      disabled={isImporting}
                      onChange={(event) => void handleImport(event)}
                      className="sr-only"
                    />
                </label>
              </div>
            </div>
          </div>
          )}

          {/* Diagrams List */}
          <div className="bg-card border border-border shadow-sm rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                {t('workspace.diagram.list')}
              </h3>

              {diagrams.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">{t('workspace.diagram.empty')}</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {t('workspace.diagram.emptyDetail')}
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
                            onClick={(e) => openArchiveModal(diagram, e)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                            title={t('workspace.diagram.archiveLabel')}
                            aria-label={t('workspace.diagram.archiveLabel')}
                          >
                            <Archive size={16} className="text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 mb-3">
                        {t((diagram.data?.classes?.length || 0) === 1 ? 'workspace.diagram.classCountOne' : 'workspace.diagram.classCount', { count: diagram.data?.classes?.length || 0 })} •{' '}
                        {t((diagram.data?.relations?.length || 0) === 1 ? 'workspace.diagram.relationCountOne' : 'workspace.diagram.relationCount', { count: diagram.data?.relations?.length || 0 })}
                      </div>
                      <div className="text-xs text-gray-400">
                        {t('workspace.diagram.updated', { date: formatDate(diagram.updatedAt) })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {currentRole === Role.OWNER && (
            <div className="bg-card border border-border shadow-sm rounded-lg mt-8">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  {t('workspace.diagram.archivedList')}
                </h3>
                {archivedDiagrams.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('workspace.diagram.archivedEmpty')}</p>
                ) : (
                  <div className="space-y-3">
                    {archivedDiagrams.map((diagram) => (
                      <div key={diagram.id} className="flex items-center justify-between rounded-md border border-border p-3">
                        <div>
                          <p className="font-medium text-foreground">{diagram.name}</p>
                          <p className="text-xs text-muted-foreground">v{diagram.version}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRestoreDiagram(diagram.id)}
                          disabled={restoringDiagramId === diagram.id}
                          className="flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                        >
                          <RotateCcw size={16} />
                          {t('workspace.diagram.restoreLabel')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Collaborators */}
          {currentWorkspace.collaborators.length > 0 && (
            <div className="bg-card border border-border shadow-sm rounded-lg mt-8">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  {t('workspace.collaborators')}
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
                    <span className="text-xs text-blue-600 font-medium">{t('roles.owner')}</span>
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
                      <span className="text-xs text-gray-600 font-medium">{collaborator.role === Role.EDITOR ? t('roles.editor') : t('roles.viewer')}</span>
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
              workspaceId={workspaceId}
              role={currentRole}
              allowViewerComments={currentWorkspace.allowViewerComments}
            />
          )}

          {activeTab === 'members' && (
            <MemberManagement
              workspaceId={workspaceId}
              role={currentRole}
              onWorkspaceChanged={() => fetchWorkspaceById(workspaceId)}
            />
          )}

          {activeTab === 'settings' && currentRole === Role.OWNER && (
            <WorkspaceSettings
              workspace={currentWorkspace}
              onWorkspaceChanged={() => fetchWorkspaceById(workspaceId)}
              onOwnershipTransferred={async () => {
                await fetchWorkspaceById(workspaceId);
                setActiveTab('members');
              }}
            />
          )}
        </div>
      </main>

      {/* Invite Collaborator Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative bg-card border border-border rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">{t('workspace.invite.title')}</h3>
              <button
                onClick={() => setIsShareModalOpen(false)}
                aria-label={t('common.close')}
                className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleInviteCollaborator} className="p-6">
              <div className="mb-4">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('workspace.invite.email')} *
                </label>
                <input
                  type="email"
                  id="email"
                  value={collaboratorEmail}
                  onChange={(e) => setCollaboratorEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"
                  placeholder={t('workspace.invite.emailPlaceholder')}
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  {t('workspace.invite.emailHelp')}
                </p>
              </div>

              <div className="mb-6">
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('workspace.invite.role')}
                </label>
                <select
                  id="role"
                  value={collaboratorRole}
                  onChange={(e) => setCollaboratorRole(e.target.value as 'EDITOR' | 'VIEWER')}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-500">
                  <option value="VIEWER">{t('workspace.invite.viewerOption')}</option>
                  <option value="EDITOR">{t('workspace.invite.editorOption')}</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50">
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!collaboratorEmail.trim() || isInviting}
                  className="px-4 py-2 bg-gray-600 text-white rounded text-sm font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2">
                  {isInviting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>{t('workspace.invite.inviting')}</span>
                    </>
                  ) : (
                    <span>{t('workspace.invite.action')}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {importPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">{t('interchange.previewTitle')}</h3>
                <p className="text-sm text-muted-foreground">{importPreview.name} · {importPreview.format.toUpperCase()}</p>
              </div>
              <button
                type="button"
                onClick={() => setImportPreview(null)}
                aria-label={t('common.close')}
                className="rounded p-2 text-muted-foreground hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border border-border bg-muted/40 p-3">
                  <div className="text-2xl font-semibold text-foreground">{importPreview.accepted.classes}</div>
                  <div className="text-sm text-muted-foreground">{t('interchange.classes')}</div>
                </div>
                <div className="rounded-md border border-border bg-muted/40 p-3">
                  <div className="text-2xl font-semibold text-foreground">{importPreview.accepted.relations}</div>
                  <div className="text-sm text-muted-foreground">{t('interchange.relations')}</div>
                </div>
              </div>
              {importPreview.warnings.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="mb-1 font-medium">{t('interchange.warnings')}</p>
                  <ul className="list-disc space-y-1 pl-5">
                    {importPreview.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                </div>
              )}
              <p className="text-sm text-muted-foreground">{t('interchange.confirmHelp')}</p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setImportPreview(null)}
                  disabled={isConfirmingImport}
                  className="min-h-11 rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-muted"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmImport()}
                  disabled={isConfirmingImport}
                  className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isConfirmingImport ? t('interchange.confirming') : t('interchange.confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Archive Diagram Confirmation Modal */}
      {isArchiveModalOpen && diagramToArchive && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative bg-card border border-border rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">{t('workspace.archiveDialog.title')}</h3>
              <button
                onClick={() => setIsArchiveModalOpen(false)}
                aria-label={t('common.close')}
                className="text-gray-400 hover:text-gray-600"
                disabled={isArchiving}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="flex-shrink-0">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-muted">
                    <Archive className="h-6 w-6 text-muted-foreground" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-700">
                    {t('workspace.archiveDialog.question', { name: diagramToArchive.name })}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t('workspace.archiveDialog.warning')}
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsArchiveModalOpen(false)}
                  disabled={isArchiving}
                  className="px-4 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleArchiveDiagram}
                  disabled={isArchiving}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isArchiving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>{t('workspace.archiveDialog.archiving')}</span>
                    </>
                  ) : (
                    <>
                      <Archive size={16} />
                      <span>{t('workspace.archiveDialog.action')}</span>
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
