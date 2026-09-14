import { AuditService } from './audit.service';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('AuditService', () => {
  const prisma = {
    auditEvent: {
      create: jest.fn(),
    },
  };

  let service: AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.auditEvent.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'audit-1', ...data }),
    );
    service = new AuditService(prisma as any);
  });

  it('removes sensitive metadata before persisting an audit event', async () => {
    await service.record({
      workspaceId: 'workspace-1',
      actorId: 'user-1',
      action: 'REVISION_DOWNLOADED' as any,
      entityType: 'CodeRevision',
      entityId: 'revision-1',
      metadata: {
        fileCount: 3,
        token: 'secret-token',
        password: 'secret-password',
        storageKey: 'private/object',
        path: 'C:/private/source',
        content: 'class Secret {}',
        nested: { secret: 'hidden', safe: true },
      },
    });

    expect(prisma.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'workspace-1',
        actorId: 'user-1',
        metadata: {
          fileCount: 3,
          nested: { safe: true },
        },
      }),
    });
  });

  it('rejects metadata larger than eight kilobytes after sanitization', async () => {
    await expect(
      service.record({
        workspaceId: 'workspace-1',
        actorId: 'user-1',
        action: 'REVISION_PUBLISHED' as any,
        entityType: 'CodeRevision',
        entityId: 'revision-1',
        metadata: { safeDescription: 'x'.repeat(8193) },
      }),
    ).rejects.toThrow('Audit metadata exceeds 8192 bytes');

    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
  });

  it('declares the complete project lifecycle persistence contract', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8');

    expect(schema).toContain('archivedAt DateTime?');
    expect(schema).toContain('enum InvitationStatus');
    expect(schema).toContain('model WorkspaceInvitation');
    expect(schema).toContain('@@unique([workspaceId, email])');
    for (const action of [
      'WORKSPACE_UPDATED',
      'WORKSPACE_OWNERSHIP_TRANSFERRED',
      'INVITATION_CREATED',
      'INVITATION_CLAIMED',
      'INVITATION_REVOKED',
      'DIAGRAM_ARCHIVED',
      'DIAGRAM_RESTORED',
    ]) {
      expect(schema).toContain(action);
    }
  });
});
