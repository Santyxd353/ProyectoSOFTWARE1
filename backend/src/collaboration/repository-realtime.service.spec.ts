import { RepositoryRealtimeService } from './repository-realtime.service';

describe('RepositoryRealtimeService access revocation', () => {
  it('removes only the revoked user from diagram and workspace revision rooms', async () => {
    const service = new RepositoryRealtimeService();
    const revoked = {
      data: { user: { id: 'viewer-1' } },
      rooms: new Set(['socket-1', 'diagram-1', 'diagram-other', 'workspace:workspace-1:revision:rev-1']),
      leave: jest.fn(async (room: string) => revoked.rooms.delete(room)),
      emit: jest.fn(),
    };
    const other = {
      data: { user: { id: 'editor-1' } },
      rooms: new Set(['socket-2', 'diagram-1', 'workspace:workspace-1:revision:rev-1']),
      leave: jest.fn(),
      emit: jest.fn(),
    };
    service.attachServer({
      sockets: new Map([['socket-1', revoked], ['socket-2', other]]),
    } as any);

    await service.revokeWorkspaceAccess('workspace-1', 'viewer-1', ['diagram-1']);

    expect(revoked.rooms).toEqual(new Set(['socket-1', 'diagram-other']));
    expect(revoked.emit).toHaveBeenCalledWith('workspace_access_revoked', {
      workspaceId: 'workspace-1',
    });
    expect(other.leave).not.toHaveBeenCalled();
  });
});
