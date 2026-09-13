'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Shield, Trash2 } from 'lucide-react';
import { workspaceAPI } from '@/lib/api';
import { repositoryCapabilities } from '@/lib/repository-capabilities';
import {
  Role,
  WorkspaceMember,
  WorkspaceMembersResponse,
} from '@/types/workspace';
import { useI18n } from '@/components/i18n/I18nProvider';

interface MemberManagementProps {
  workspaceId: string;
  role: Role;
  onWorkspaceChanged: () => Promise<void>;
}

export default function MemberManagement({ workspaceId, role, onWorkspaceChanged }: MemberManagementProps) {
  const [data, setData] = useState<WorkspaceMembersResponse | null>(null);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const { canManageMembers } = repositoryCapabilities(role, false);
  const { t } = useI18n();

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await workspaceAPI.getMembers(workspaceId));
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || t('members.loadError'));
    }
  }, [t, workspaceId]);

  useEffect(() => { void load(); }, [load]);

  const updateRole = async (member: WorkspaceMember, nextRole: Role.EDITOR | Role.VIEWER) => {
    setBusyId(member.id);
    setError('');
    setStatus('');
    try {
      await workspaceAPI.updateMemberRole(workspaceId, member.id, nextRole);
      await Promise.all([load(), onWorkspaceChanged()]);
      setStatus(t('members.roleUpdated'));
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || t('members.roleUpdateError'));
    } finally {
      setBusyId('');
    }
  };

  const remove = async (member: WorkspaceMember) => {
    if (!window.confirm(t('members.removeConfirm', { name: member.user.name }))) return;
    setBusyId(member.id);
    setError('');
    setStatus('');
    try {
      await workspaceAPI.removeMember(workspaceId, member.id);
      await Promise.all([load(), onWorkspaceChanged()]);
      setStatus(t('members.removed'));
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || t('members.removeError'));
    } finally {
      setBusyId('');
    }
  };

  const updatePolicy = async (allowViewerComments: boolean) => {
    setBusyId('policy');
    setError('');
    setStatus('');
    try {
      await workspaceAPI.updateRepositoryPolicy(workspaceId, allowViewerComments);
      await Promise.all([load(), onWorkspaceChanged()]);
      setStatus(t('members.policyUpdated'));
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || t('members.policyError'));
    } finally {
      setBusyId('');
    }
  };

  if (!data) {
    return <div className="flex min-h-52 items-center justify-center gap-2 text-muted-foreground"><Loader2 size={20} className="animate-spin" /> {t('members.loading')}</div>;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-card p-5" aria-labelledby="members-title">
        <div className="flex items-start gap-3">
          <Shield size={22} className="mt-0.5 text-primary" />
          <div>
            <h2 id="members-title" className="text-lg font-semibold text-card-foreground">{t('members.title')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('members.description')}</p>
          </div>
        </div>
        {canManageMembers && (
          <label className="mt-5 flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-md border border-border bg-muted/50 px-4 py-3">
            <span>
              <span className="block text-sm font-medium text-foreground">{t('members.allowViewerComments')}</span>
              <span className="block text-xs text-muted-foreground">{t('members.viewerHelp')}</span>
            </span>
            <input
              type="checkbox"
              checked={data.allowViewerComments}
              disabled={busyId === 'policy'}
              onChange={(event) => void updatePolicy(event.target.checked)}
              className="h-5 w-5 rounded border-input text-primary focus:ring-ring"
            />
          </label>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <ul className="divide-y divide-border">
          {data.members.map((member) => {
            const owner = member.role === Role.OWNER;
            const busy = busyId === member.id;
            return (
              <li key={`${member.role}-${member.id}`} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-medium text-card-foreground">{member.user.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{member.user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {canManageMembers && !owner ? (
                    <>
                      <label className="sr-only" htmlFor={`role-${member.id}`}>{t('members.roleOf', { name: member.user.name })}</label>
                      <select
                        id={`role-${member.id}`}
                        value={member.role}
                        disabled={busy}
                        onChange={(event) => void updateRole(member, event.target.value as Role.EDITOR | Role.VIEWER)}
                        className="min-h-11 rounded-md border border-input text-sm"
                      >
                        <option value={Role.EDITOR}>{t('roles.editor')}</option>
                        <option value={Role.VIEWER}>{t('roles.viewer')}</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => void remove(member)}
                        disabled={busy}
                        aria-label={t('members.remove', { name: member.user.name })}
                        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {busy ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={17} />}
                      </button>
                    </>
                  ) : (
                    <span className="rounded-md bg-muted px-3 py-2 text-sm font-medium text-muted-foreground">
                      {owner ? t('roles.owner') : member.role === Role.EDITOR ? t('roles.editor') : t('roles.viewer')}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {status && <p role="status" className="text-sm text-primary">{status}</p>}
    </div>
  );
}
