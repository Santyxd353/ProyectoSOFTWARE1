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

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await workspaceAPI.getMembers(workspaceId));
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'No se pudieron cargar los miembros.');
    }
  }, [workspaceId]);

  useEffect(() => { void load(); }, [load]);

  const updateRole = async (member: WorkspaceMember, nextRole: Role.EDITOR | Role.VIEWER) => {
    setBusyId(member.id);
    setError('');
    setStatus('');
    try {
      await workspaceAPI.updateMemberRole(workspaceId, member.id, nextRole);
      await Promise.all([load(), onWorkspaceChanged()]);
      setStatus('Rol actualizado.');
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'No se pudo actualizar el rol.');
    } finally {
      setBusyId('');
    }
  };

  const remove = async (member: WorkspaceMember) => {
    if (!window.confirm(`¿Quitar a ${member.user.name} del proyecto?`)) return;
    setBusyId(member.id);
    setError('');
    setStatus('');
    try {
      await workspaceAPI.removeMember(workspaceId, member.id);
      await Promise.all([load(), onWorkspaceChanged()]);
      setStatus('Miembro retirado.');
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'No se pudo retirar el miembro.');
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
      setStatus('Política de comentarios actualizada.');
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'No se pudo actualizar la política.');
    } finally {
      setBusyId('');
    }
  };

  if (!data) {
    return <div className="flex min-h-52 items-center justify-center gap-2 text-muted-foreground"><Loader2 size={20} className="animate-spin" /> Cargando miembros…</div>;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-card p-5" aria-labelledby="members-title">
        <div className="flex items-start gap-3">
          <Shield size={22} className="mt-0.5 text-primary" />
          <div>
            <h2 id="members-title" className="text-lg font-semibold text-card-foreground">Miembros y permisos</h2>
            <p className="mt-1 text-sm text-muted-foreground">Los roles controlan diagramas, revisiones, descargas y comentarios.</p>
          </div>
        </div>
        {canManageMembers && (
          <label className="mt-5 flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-md border border-border bg-muted/50 px-4 py-3">
            <span>
              <span className="block text-sm font-medium text-foreground">Permitir comentarios de observadores</span>
              <span className="block text-xs text-muted-foreground">VIEWER conserva acceso de solo lectura al código.</span>
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
                      <label className="sr-only" htmlFor={`role-${member.id}`}>Rol de {member.user.name}</label>
                      <select
                        id={`role-${member.id}`}
                        value={member.role}
                        disabled={busy}
                        onChange={(event) => void updateRole(member, event.target.value as Role.EDITOR | Role.VIEWER)}
                        className="min-h-11 rounded-md border border-input text-sm"
                      >
                        <option value={Role.EDITOR}>Editor</option>
                        <option value={Role.VIEWER}>Observador</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => void remove(member)}
                        disabled={busy}
                        aria-label={`Quitar a ${member.user.name}`}
                        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {busy ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={17} />}
                      </button>
                    </>
                  ) : (
                    <span className="rounded-md bg-muted px-3 py-2 text-sm font-medium text-muted-foreground">
                      {owner ? 'Propietario' : member.role === Role.EDITOR ? 'Editor' : 'Observador'}
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
