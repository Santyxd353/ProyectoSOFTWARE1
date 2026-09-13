'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, History, Loader2, RotateCcw } from 'lucide-react';
import { repositoryAPI } from '@/lib/api';
import { buildRepositoryTree } from '@/lib/repository-tree';
import { repositoryCapabilities } from '@/lib/repository-capabilities';
import { Role } from '@/types/workspace';
import {
  RevisionFile,
  RevisionFileContent,
  RevisionSummary,
} from '@/types/repository';
import CommentPanel from './CommentPanel';
import FileTree from './FileTree';
import FileViewer from './FileViewer';
import RevisionCompare from './RevisionCompare';
import { useI18n } from '@/components/i18n/I18nProvider';

interface CodeRepositoryPanelProps {
  workspaceId: string;
  role: Role;
  allowViewerComments: boolean;
}

export default function CodeRepositoryPanel({ workspaceId, role, allowViewerComments }: CodeRepositoryPanelProps) {
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [revisionId, setRevisionId] = useState('');
  const [files, setFiles] = useState<RevisionFile[]>([]);
  const [file, setFile] = useState<RevisionFileContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const { t, formatDate } = useI18n();

  const loadRevisions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await repositoryAPI.listRevisions(workspaceId);
      setRevisions(data);
      setRevisionId((current) => data.some((item) => item.id === current) ? current : data[0]?.id ?? '');
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || t('repository.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t, workspaceId]);

  useEffect(() => { void loadRevisions(); }, [loadRevisions]);

  useEffect(() => {
    setFile(null);
    if (!revisionId) {
      setFiles([]);
      return;
    }
    repositoryAPI.getTree(workspaceId, revisionId)
      .then(setFiles)
      .catch((requestError) => setError(requestError.response?.data?.message || t('repository.treeError')));
  }, [t, workspaceId, revisionId]);

  const openFile = async (fileId: string) => {
    setError('');
    try {
      setFile(await repositoryAPI.readFile(workspaceId, revisionId, fileId));
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || t('repository.openError'));
    }
  };

  const download = async () => {
    setActionLoading(true);
    setError('');
    try {
      const blob = await repositoryAPI.download(workspaceId, revisionId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `revision-${revisionId}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || t('repository.downloadError'));
    } finally {
      setActionLoading(false);
    }
  };

  const restore = async () => {
    setActionLoading(true);
    setError('');
    try {
      const restored = await repositoryAPI.restore(workspaceId, revisionId);
      await loadRevisions();
      setRevisionId(restored.id);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || t('repository.restore.error'));
    } finally {
      setActionLoading(false);
    }
  };

  const tree = useMemo(() => buildRepositoryTree(files), [files]);
  const selectedRevision = revisions.find((revision) => revision.id === revisionId);
  const { canRestore, canComment } = repositoryCapabilities(
    role,
    allowViewerComments,
  );

  if (loading) {
    return <div className="flex min-h-64 items-center justify-center gap-2 text-muted-foreground"><Loader2 className="animate-spin" size={20} /> {t('repository.loading')}</div>;
  }

  if (revisions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
        <History className="mx-auto text-muted-foreground" size={36} />
        <h2 className="mt-3 text-lg font-semibold text-card-foreground">{t('repository.empty')}</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{t('repository.emptyDetail')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <label className="block text-sm font-medium text-foreground">
            {t('repository.revision')}
            <select value={revisionId} onChange={(event) => setRevisionId(event.target.value)} className="mt-1 min-h-11 w-full min-w-64 rounded-md border border-input lg:w-auto">
              {revisions.map((revision) => (
                <option key={revision.id} value={revision.id}>
                  UML v{revision.modelVersion} · {revision.projectType} · {formatDate(revision.createdAt)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={download} disabled={actionLoading} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md bg-secondary px-4 font-medium text-secondary-foreground hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Download size={16} /> {t('repository.download')}
            </button>
            {canRestore && (
              <button type="button" onClick={restore} disabled={actionLoading} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md bg-primary px-4 font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <RotateCcw size={16} /> {t('repository.restore.action')}
              </button>
            )}
          </div>
        </div>
        {selectedRevision && (
          <dl className="mt-4 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-3">
            <div><dt className="text-muted-foreground">{t('repository.generator')}</dt><dd className="font-medium text-foreground">{selectedRevision.generator}</dd></div>
            <div><dt className="text-muted-foreground">{t('repository.files')}</dt><dd className="font-medium text-foreground">{selectedRevision.fileCount}</dd></div>
            <div><dt className="text-muted-foreground">{t('repository.comments')}</dt><dd className="font-medium text-foreground">{selectedRevision.commentCount}</dd></div>
          </dl>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      </section>

      <div className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)_20rem]">
        <aside className="rounded-lg border border-border bg-card p-3" aria-label={t('repository.filesLabel')}>
          <FileTree nodes={tree} selectedFileId={file?.id} onSelect={openFile} />
        </aside>
        <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-card" aria-label={t('repository.preview')}>
          {file && <header className="border-b border-border px-4 py-3"><code className="text-sm font-medium text-foreground">{file.path}</code></header>}
          <FileViewer file={file} />
        </section>
        {file ? (
          <CommentPanel workspaceId={workspaceId} revisionId={revisionId} fileId={file.id} canComment={canComment} />
        ) : (
          <aside className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">{t('repository.selectForComments')}</aside>
        )}
      </div>

      <RevisionCompare workspaceId={workspaceId} revisions={revisions} />
    </div>
  );
}
