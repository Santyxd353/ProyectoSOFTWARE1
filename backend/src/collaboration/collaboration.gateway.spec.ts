import { CollaborationGateway } from './collaboration.gateway';

describe('CollaborationGateway durable changes', () => {
  it('returns missed durable events when an editor rejoins', async () => {
    const collaboration = {
      joinDiagram: jest.fn().mockResolvedValue(true),
      handleDisconnect: jest.fn(),
    };
    const operations = {
      eventsAfter: jest.fn().mockResolvedValue([
        { id: 'operation-2', serverSequence: 2, resultVersion: 4 },
      ]),
    };
    const client: any = {
      id: 'socket-1',
      data: { user: { id: 'editor-1', name: 'Editor' } },
      to: jest.fn(() => ({ emit: jest.fn() })),
    };
    const gateway = new (CollaborationGateway as any)(
      collaboration,
      {},
      {},
      {},
      {},
      operations,
    );

    const result = await gateway.handleJoinDiagram(client, {
      diagramId: 'diagram-1',
      afterSequence: 1,
    });

    expect(operations.eventsAfter).toHaveBeenCalledWith(
      'diagram-1',
      'editor-1',
      1,
    );
    expect(result).toEqual({
      success: true,
      events: [{ id: 'operation-2', serverSequence: 2, resultVersion: 4 }],
    });
  });

  it('broadcasts a diagram change only after it was persisted', async () => {
    const order: string[] = [];
    const collaboration = { handleDisconnect: jest.fn() };
    const socketAuth = {};
    const authorization = {};
    const prisma = {};
    const realtime = {};
    const operations = {
      apply: jest.fn(async () => {
        order.push('persist');
        return {
          status: 'APPLIED',
          operationId: 'operation-1',
          sequence: 7,
          version: 4,
        };
      }),
    };
    const emit = jest.fn(() => order.push('broadcast'));
    const client: any = {
      id: 'socket-1',
      data: { user: { id: 'editor-1', name: 'Editor' } },
      to: jest.fn(() => ({ emit })),
    };
    const gateway = new (CollaborationGateway as any)(
      collaboration,
      socketAuth,
      authorization,
      prisma,
      realtime,
      operations,
    );

    const result = await gateway.handleDiagramChange(client, {
      diagramId: 'diagram-1',
      deviceId: 'browser-abc',
      clientSequence: 3,
      baseVersion: 3,
      changes: {
        type: 'full_update',
        data: { classes: [], relations: [] },
      },
    });

    expect(result).toMatchObject({ success: true, sequence: 7, version: 4 });
    expect(order).toEqual(['persist', 'broadcast']);
    expect(emit).toHaveBeenCalledWith(
      'diagram_change',
      expect.objectContaining({ sequence: 7, version: 4 }),
    );
  });

  it('does not broadcast a conflicting operation', async () => {
    const operations = {
      apply: jest.fn().mockResolvedValue({
        status: 'CONFLICT',
        operationId: 'operation-1',
        conflictId: 'conflict-1',
        sequence: 7,
        version: 4,
      }),
    };
    const emit = jest.fn();
    const client: any = {
      id: 'socket-1',
      data: { user: { id: 'editor-1', name: 'Editor' } },
      to: jest.fn(() => ({ emit })),
    };
    const gateway = new (CollaborationGateway as any)(
      { handleDisconnect: jest.fn() },
      {},
      {},
      {},
      {},
      operations,
    );

    const result = await gateway.handleDiagramChange(client, {
      diagramId: 'diagram-1',
      deviceId: 'browser-abc',
      clientSequence: 3,
      baseVersion: 2,
      changes: {
        type: 'full_update',
        data: { classes: [], relations: [] },
      },
    });

    expect(result).toMatchObject({
      success: false,
      status: 'CONFLICT',
      conflictId: 'conflict-1',
    });
    expect(emit).not.toHaveBeenCalled();
  });

  it('broadcasts an authorized transient preview without treating it as durable', async () => {
    const collaboration = {
      handleDisconnect: jest.fn(),
      assertDiagramEditAccess: jest.fn().mockResolvedValue(undefined),
    };
    const operations = { apply: jest.fn() };
    const emit = jest.fn();
    const client: any = {
      id: 'socket-1',
      data: { user: { id: 'editor-1', name: 'Editor' } },
      to: jest.fn(() => ({ emit })),
    };
    const gateway = new (CollaborationGateway as any)(
      collaboration,
      {},
      {},
      {},
      {},
      operations,
    );

    const result = await gateway.handleDiagramPreview(client, {
      diagramId: 'diagram-1',
      changes: { type: 'nodes', nodes: [] },
    });

    expect(result).toEqual({ success: true });
    expect(collaboration.assertDiagramEditAccess).toHaveBeenCalledWith(
      'diagram-1',
      'editor-1',
    );
    expect(operations.apply).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      'diagram_preview',
      expect.objectContaining({ userId: 'editor-1' }),
    );
  });
});
