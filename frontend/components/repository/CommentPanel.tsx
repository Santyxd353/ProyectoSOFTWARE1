'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Loader2, MessageSquarePlus } from 'lucide-react';
import { repositoryAPI } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { ReviewComment } from '@/types/repository';
import { useI18n } from '@/components/i18n/I18nProvider';

interface CommentPanelProps {
  workspaceId: string;
  revisionId: string;
  fileId: string;
  canComment: boolean;
}

export default function CommentPanel({ workspaceId, revisionId, fileId, canComment }: CommentPanelProps) {
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [body, setBody] = useState('');
  const [line, setLine] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useI18n();
  const { isConnected, emit, on } = useSocket(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001');

  useEffect(() => {
    repositoryAPI.listComments(workspaceId, revisionId, fileId)
      .then(setComments)
      .catch(() => setError(t('repository.comments.loadError')));
  }, [t, workspaceId, revisionId, fileId]);

  useEffect(() => {
    if (isConnected) emit('join_revision', { workspaceId, revisionId });
  }, [isConnected, emit, workspaceId, revisionId]);

  useEffect(() => {
    const unsubscribe = on('review_comment_created', (comment: ReviewComment) => {
      if (comment.revisionId === revisionId && comment.fileId === fileId) {
        setComments((current) => current.some((item) => item.id === comment.id) ? current : [...current, comment]);
      }
    });
    return () => {
      unsubscribe?.();
    };
  }, [on, revisionId, fileId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || trimmed.length > 4000) {
      setError(t('repository.comments.validation'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const comment = await repositoryAPI.createComment(workspaceId, revisionId, {
        fileId,
        body: trimmed,
        ...(line ? { line: Number(line) } : {}),
      });
      setComments((current) => current.some((item) => item.id === comment.id) ? current : [...current, comment]);
      setBody('');
      setLine('');
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || t('repository.comments.saveError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className="rounded-lg border border-border bg-card p-4" aria-labelledby="comments-title">
      <h3 id="comments-title" className="mb-3 font-semibold text-card-foreground">{t('repository.comments.title')}</h3>
      <div className="max-h-64 space-y-3 overflow-auto" aria-live="polite">
        {comments.length === 0 && <p className="text-sm text-muted-foreground">{t('repository.comments.empty')}</p>}
        {comments.map((comment) => (
          <article key={comment.id} className="rounded-md bg-muted p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <strong className="text-foreground">{comment.author.name}</strong>
              {comment.line && <span className="text-xs text-muted-foreground">{t('repository.comments.line', { line: comment.line })}</span>}
            </div>
            <p className="mt-1 whitespace-pre-wrap text-foreground">{comment.body}</p>
          </article>
        ))}
      </div>
      {canComment ? (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-foreground">
            {t('repository.comments.optionalLine')}
            <input type="number" min="1" value={line} onChange={(event) => setLine(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-input" />
          </label>
          <label className="block text-sm font-medium text-foreground">
            {t('repository.comments.comment')}
            <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={4000} rows={3} className="mt-1 w-full rounded-md border border-input" />
          </label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={loading || !body.trim()} className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <MessageSquarePlus size={16} />}
            {t('repository.comments.action')}
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">{t('repository.comments.readOnly')}</p>
      )}
    </aside>
  );
}
