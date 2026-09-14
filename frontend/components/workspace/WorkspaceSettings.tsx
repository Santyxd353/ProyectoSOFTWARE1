'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Loader2, Settings2, UserCog } from 'lucide-react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { workspaceAPI } from '@/lib/api';
import { Workspace } from '@/types/workspace';

interface WorkspaceSettingsProps {
  workspace: Workspace;
  onWorkspaceChanged: () => Promise<void>;
  onOwnershipTransferred: () => Promise<void>;
}

export default function WorkspaceSettings({
  workspace,
  onWorkspaceChanged,
  onOwnershipTransferred,
}: WorkspaceSettingsProps) {
  const { t } = useI18n();
  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description || '');
  const [saving, setSaving] = useState(false);
  const [memberId, setMemberId] = useState('');
  const [confirmationName, setConfirmationName] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setName(workspace.name);
    setDescription(workspace.description || '');
  }, [workspace.name, workspace.description]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setStatus('');
    setError('');
    try {
      await workspaceAPI.updateWorkspace(workspace.id, { name, description });
      await onWorkspaceChanged();
      setStatus(t('workspace.settings.saved'));
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || t('workspace.settings.error'));
    } finally {
      setSaving(false);
    }
  };

  const transfer = async (event: FormEvent) => {
    event.preventDefault();
    setTransferring(true);
    setStatus('');
    setError('');
    try {
      await workspaceAPI.transferOwnership(workspace.id, memberId, confirmationName);
      setStatus(t('workspace.transfer.success'));
      await onOwnershipTransferred();
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || t('workspace.transfer.error'));
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <Settings2 size={22} className="mt-0.5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-card-foreground">{t('workspace.settings.title')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('workspace.settings.description')}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-foreground">
            {t('workspace.settings.name')}
            <input value={name} onChange={(event) => setName(event.target.value)} required className="min-h-11 rounded-md border border-input bg-background px-3" />
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            {t('workspace.settings.projectDescription')}
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className="rounded-md border border-input bg-background px-3 py-2" />
          </label>
          <button disabled={saving || !name.trim()} className="flex min-h-11 w-fit items-center gap-2 rounded-md bg-primary px-4 text-primary-foreground disabled:opacity-50">
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving ? t('workspace.settings.saving') : t('workspace.settings.save')}
          </button>
        </div>
      </form>

      <form onSubmit={transfer} className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <UserCog size={22} className="mt-0.5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-card-foreground">{t('workspace.transfer.title')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('workspace.transfer.description')}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-foreground">
            {t('workspace.transfer.member')}
            <select value={memberId} onChange={(event) => setMemberId(event.target.value)} required className="min-h-11 rounded-md border border-input bg-background px-3">
              <option value="">{t('workspace.transfer.select')}</option>
              {workspace.collaborators.map((member) => (
                <option key={member.id} value={member.id}>{member.user.name} — {member.user.email}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            {t('workspace.transfer.confirmation', { name: workspace.name })}
            <input value={confirmationName} onChange={(event) => setConfirmationName(event.target.value)} required className="min-h-11 rounded-md border border-input bg-background px-3" />
          </label>
          <button disabled={transferring || !memberId || confirmationName.trim() !== workspace.name} className="flex min-h-11 w-fit items-center gap-2 rounded-md border border-destructive px-4 text-destructive hover:bg-destructive/10 disabled:opacity-50">
            {transferring && <Loader2 size={16} className="animate-spin" />}
            {transferring ? t('workspace.transfer.transferring') : t('workspace.transfer.action')}
          </button>
        </div>
      </form>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {status && <p role="status" className="text-sm text-primary">{status}</p>}
    </div>
  );
}
