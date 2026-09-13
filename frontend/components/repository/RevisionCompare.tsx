'use client';

import { useEffect, useState } from 'react';
import { GitCompare, Loader2 } from 'lucide-react';
import { repositoryAPI } from '@/lib/api';
import { RevisionComparison, RevisionDiffKind, RevisionSummary } from '@/types/repository';
import { useI18n } from '@/components/i18n/I18nProvider';

export default function RevisionCompare({ workspaceId, revisions }: { workspaceId: string; revisions: RevisionSummary[] }) {
  const [base, setBase] = useState('');
  const [target, setTarget] = useState('');
  const [result, setResult] = useState<RevisionComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useI18n();
  const diffLabel = (kind: RevisionDiffKind) => ({
    ADDED: t('repository.compare.added'),
    REMOVED: t('repository.compare.removed'),
    MODIFIED: t('repository.compare.modified'),
    UNCHANGED: t('repository.compare.unchanged'),
    BINARY_MODIFIED: t('repository.compare.binaryModified'),
  })[kind];

  useEffect(() => {
    setTarget(revisions[0]?.id ?? '');
    setBase(revisions[1]?.id ?? revisions[0]?.id ?? '');
    setResult(null);
  }, [revisions]);

  const compare = async () => {
    if (!base || !target) return;
    setLoading(true);
    setError('');
    try {
      setResult(await repositoryAPI.compare(workspaceId, base, target));
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || t('repository.compare.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4" aria-labelledby="compare-title">
      <div className="mb-4 flex items-center gap-2">
        <GitCompare size={18} className="text-primary" />
        <h3 id="compare-title" className="font-semibold text-card-foreground">{t('repository.compare.title')}</h3>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label className="text-sm font-medium text-foreground">
          {t('repository.compare.base')}
          <select value={base} onChange={(event) => setBase(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-input">
            {revisions.map((revision) => <option key={revision.id} value={revision.id}>v{revision.modelVersion} · {revision.projectType}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-foreground">
          {t('repository.compare.target')}
          <select value={target} onChange={(event) => setTarget(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-input">
            {revisions.map((revision) => <option key={revision.id} value={revision.id}>v{revision.modelVersion} · {revision.projectType}</option>)}
          </select>
        </label>
        <button type="button" onClick={compare} disabled={!base || !target || loading} className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md bg-secondary px-4 font-medium text-secondary-foreground hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <GitCompare size={16} />}
          {t('repository.compare.action')}
        </button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      {result && (
        <div className="mt-4 space-y-3">
          {result.files.map((file) => (
            <article key={file.path} className="overflow-hidden rounded-md border border-border">
              <header className="flex flex-wrap items-center justify-between gap-2 bg-muted px-3 py-2">
                <code className="text-sm text-foreground">{file.path}</code>
                <span className="rounded bg-background px-2 py-1 text-xs font-medium text-muted-foreground">{diffLabel(file.kind)}</span>
              </header>
              {file.patch && <pre className="max-h-80 overflow-auto whitespace-pre p-3 text-xs leading-5 text-foreground">{file.patch}</pre>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
