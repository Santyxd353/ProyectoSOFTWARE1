'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, Link2, Loader2, Mail, Shield, Trash2, XCircle } from 'lucide-react';
import { workspaceAPI } from '@/lib/api';
import { repositoryCapabilities } from '@/lib/repository-capabilities';
import {
  Role,
  WorkspaceMember,
  WorkspaceMembersResponse,
  WorkspaceInvitation,
  PortableInvitationResult,
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
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [portableRole, setPortableRole] = useState<Role.EDITOR | Role.VIEWER>(Role.VIEWER);
  const [portableExpiry, setPortableExpiry] = useState('168');
  const [portableEmail, setPortableEmail] = useState('');
  const [portableResult, setPortableResult] = useState<PortableInvitationResult | null>(null);
  const { canManageMembers } = repositoryCapabilities(role, false);
  const { t } = useI18n();

  const load = useCallback(async () => {
    setError('');
    try {
      const [members, pendingInvitations] = await Promise.all([
        workspaceAPI.getMembers(workspaceId),
        canManageMembers ? workspaceAPI.getInvitations(workspaceId) : Promise.resolve([]),
      ]);
      setData(members);
      setInvitations(pendingInvitations);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || t('members.loadError'));
    }
  }, [canManageMembers, t, workspaceId]);

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

  const revokeInvitation = async (invitation: WorkspaceInvitation) => {
    const recipient = invitation.email || t('workspace.portableInvite.anonymous');
    if (!window.confirm(t('workspace.invitations.revokeConfirm', { email: recipient }))) return;
    setBusyId(invitation.id);
    setError('');
    setStatus('');
    try {
      await workspaceAPI.revokeInvitation(workspaceId, invitation.id);
      await load();
      setStatus(t('workspace.invitations.revoked'));
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || t('workspace.invitations.revokeError'));
    } finally {
      setBusyId('');
    }
  };

  const createPortableInvitation = async () => {
    setBusyId('portable');
    setError('');
    setStatus('');
    setPortableResult(null);
    try {
      const result = await workspaceAPI.createPortableInvitation(workspaceId, {
        role: portableRole,
        expiresInHours: Number(portableExpiry),
        ...(portableEmail.trim() ? { email: portableEmail.trim() } : {}),
      });
      setPortableResult(result);
      await load();
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || t('workspace.portableInvite.error'));
    } finally {
      setBusyId('');
    }
  };

  const copySecret = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setStatus(t('workspace.portableInvite.copied'));
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
      {canManageMembers && (
        <section className="rounded-lg border border-border bg-card p-5" aria-labelledby="portable-invite-title">
          <div className="flex items-start gap-3">
            <Link2 size={20} className="mt-0.5 text-primary" />
            <div>
              <h2 id="portable-invite-title" className="text-lg font-semibold text-card-foreground">
                {t('workspace.portableInvite.title')}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('workspace.portableInvite.description')}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="text-sm font-medium text-foreground" htmlFor="portable-role">
              {t('workspace.portableInvite.role')}
              <select
                id="portable-role"
                value={portableRole}
                onChange={(event) => setPortableRole(event.target.value as Role.EDITOR | Role.VIEWER)}
                className="mt-1 block min-h-11 w-full rounded-md border border-input bg-background"
              >
                <option value={Role.VIEWER}>{t('roles.viewer')}</option>
                <option value={Role.EDITOR}>{t('roles.editor')}</option>
              </select>
            </label>
            <label className="text-sm font-medium text-foreground" htmlFor="portable-expiry">
              {t('workspace.portableInvite.expiry')}
              <select
                id="portable-expiry"
                value={portableExpiry}
                onChange={(event) => setPortableExpiry(event.target.value)}
                className="mt-1 block min-h-11 w-full rounded-md border border-input bg-background"
              >
                <option value="24">24 h</option>
                <option value="168">7 días / 7 days</option>
                <option value="720">30 días / 30 days</option>
              </select>
            </label>
            <label className="text-sm font-medium text-foreground" htmlFor="portable-email">
              {t('workspace.portableInvite.email')}
              <input
                id="portable-email"
                type="email"
                value={portableEmail}
                onChange={(event) => setPortableEmail(event.target.value)}
                className="mt-1 block min-h-11 w-full rounded-md border border-input bg-background px-3"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={busyId === 'portable'}
            onClick={() => void createPortableInvitation()}
            className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busyId === 'portable' && <Loader2 size={17} className="animate-spin" />}
            {t('workspace.portableInvite.create')}
          </button>
          {portableResult && (
            <div className="mt-4 grid gap-3 rounded-md border border-border bg-muted/40 p-4 md:grid-cols-2">
              {[
                ['portable-link', t('workspace.portableInvite.link'), portableResult.url],
                ['portable-code', t('workspace.portableInvite.code'), portableResult.code],
              ].map(([id, label, value]) => (
                <div key={id}>
                  <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>
                  <div className="mt-1 flex gap-2">
                    <input id={id} readOnly value={value} className="min-h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3 font-mono text-sm" />
                    <button
                      type="button"
                      onClick={() => void copySecret(value)}
                      aria-label={t('workspace.portableInvite.copy', { item: label })}
                      className="flex h-11 w-11 items-center justify-center rounded-md border border-input text-foreground hover:bg-muted"
                    >
                      <Copy size={17} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

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
      {canManageMembers && (
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <Mail size={20} className="text-primary" />
            <h2 className="text-lg font-semibold text-card-foreground">{t('workspace.invitations.pending')}</h2>
          </div>
          {invitations.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">{t('workspace.invitations.empty')}</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {invitations.map((invitation) => (
                <li key={invitation.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{invitation.email || t('workspace.portableInvite.anonymous')}</p>
                    <p className="text-xs text-muted-foreground">
                      {invitation.role === Role.EDITOR ? t('roles.editor') : t('roles.viewer')}
                      {invitation.expiresAt ? ` · ${new Date(invitation.expiresAt).toLocaleString()}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void revokeInvitation(invitation)}
                    disabled={busyId === invitation.id}
                    aria-label={t('workspace.invitations.revoke', { email: invitation.email || t('workspace.portableInvite.anonymous') })}
                    className="flex h-11 w-11 items-center justify-center rounded-md text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    {busyId === invitation.id ? <Loader2 size={17} className="animate-spin" /> : <XCircle size={17} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {status && <p role="status" className="text-sm text-primary">{status}</p>}
    </div>
  );
}
