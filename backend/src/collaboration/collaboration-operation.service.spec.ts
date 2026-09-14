import { CollaborationOperationService } from './collaboration-operation.service';

describe('CollaborationOperationService', () => {
  function createHarness() {
    let diagram = {
      id: 'diagram-1',
      workspaceId: 'workspace-1',
      version: 3,
      data: {
        classes: [{ id: 'class-1', name: 'Original' }],
        relations: [],
      },
    };
    const operations: any[] = [];
    const conflicts: any[] = [];
    const audits: any[] = [];

    const database: any = {
      diagram: {
        findUnique: jest.fn(async ({ where }: any) =>
          where.id === diagram.id ? { ...diagram } : null,
        ),
        update: jest.fn(async ({ data }: any) => {
          diagram = {
            ...diagram,
            data: data.data,
            version: data.version.increment
              ? diagram.version + data.version.increment
              : data.version,
          };
          return { ...diagram };
        }),
      },
      diagramOperation: {
        findUnique: jest.fn(async ({ where }: any) => {
          const found = operations.find(
            (item) =>
              item.deviceId === where.deviceId_clientSequence.deviceId &&
              item.clientSequence ===
                where.deviceId_clientSequence.clientSequence,
          );
          return found
            ? {
                ...found,
                conflict:
                  conflicts.find((item) => item.operationId === found.id) ??
                  null,
              }
            : null;
        }),
        aggregate: jest.fn(async () => ({
          _max: {
            serverSequence: operations.reduce(
              (maximum, item) => Math.max(maximum, item.serverSequence),
              0,
            ),
          },
        })),
        create: jest.fn(async ({ data }: any) => {
          const created = { id: `operation-${operations.length + 1}`, ...data };
          operations.push(created);
          return created;
        }),
        findMany: jest.fn(async ({ where }: any) =>
          operations
            .filter(
              (item) =>
                item.diagramId === where.diagramId &&
                item.serverSequence > where.serverSequence.gt,
            )
            .sort((left, right) => left.serverSequence - right.serverSequence),
        ),
      },
      syncConflict: {
        create: jest.fn(async ({ data }: any) => {
          const created = { id: `conflict-${conflicts.length + 1}`, ...data };
          conflicts.push(created);
          return created;
        }),
        findUnique: jest.fn(async ({ where }: any) =>
          conflicts.find((item) => item.id === where.id) ?? null,
        ),
        update: jest.fn(async ({ where, data }: any) => {
          const index = conflicts.findIndex((item) => item.id === where.id);
          conflicts[index] = { ...conflicts[index], ...data };
          return conflicts[index];
        }),
        findMany: jest.fn(async () => [...conflicts]),
      },
      auditEvent: {
        create: jest.fn(async ({ data }: any) => {
          audits.push(data);
          return { id: `audit-${audits.length}`, ...data };
        }),
      },
      $transaction: jest.fn(async (callback: (tx: any) => unknown) =>
        callback(database),
      ),
    };
    const authorization = {
      require: jest.fn().mockResolvedValue({ role: 'EDITOR' }),
    };
    const service = new CollaborationOperationService(
      database,
      authorization as any,
    );
    return {
      service,
      database,
      authorization,
      operations,
      conflicts,
      audits,
      currentDiagram: () => diagram,
    };
  }

  const edit = {
    diagramId: 'diagram-1',
    userId: 'editor-1',
    deviceId: 'browser-abc',
    clientSequence: 1,
    baseVersion: 3,
    changes: {
      type: 'full_update' as const,
      data: {
        classes: [{ id: 'class-1', name: 'Actualizada' }],
        relations: [],
      },
    },
  };

  it('persists an edit before acknowledging it with ordered server state', async () => {
    const harness = createHarness();

    const result = await harness.service.apply(edit);

    expect(result).toEqual({
      status: 'APPLIED',
      operationId: 'operation-1',
      sequence: 1,
      version: 4,
    });
    expect(harness.currentDiagram()).toMatchObject({
      version: 4,
      data: edit.changes.data,
    });
    expect(harness.operations[0]).toMatchObject({
      baseVersion: 3,
      resultVersion: 4,
      beforeData: {
        classes: [{ id: 'class-1', name: 'Original' }],
        relations: [],
      },
      afterData: edit.changes.data,
      serverSequence: 1,
      status: 'APPLIED',
    });
    expect(harness.audits[0]).toMatchObject({
      action: 'DIAGRAM_OPERATION_APPLIED',
      actorId: 'editor-1',
      workspaceId: 'workspace-1',
    });
  });

  it('returns the original acknowledgement for a retried device sequence', async () => {
    const harness = createHarness();
    const first = await harness.service.apply(edit);

    const duplicate = await harness.service.apply(edit);

    expect(duplicate).toEqual({ ...first, status: 'DUPLICATE' });
    expect(harness.operations).toHaveLength(1);
    expect(harness.currentDiagram().version).toBe(4);
  });

  it('keeps both variants when the base version is stale', async () => {
    const harness = createHarness();

    const result = await harness.service.apply({
      ...edit,
      baseVersion: 2,
      changes: {
        type: 'full_update',
        data: {
          classes: [{ id: 'class-1', name: 'Variante local' }],
          relations: [],
        },
      },
    });

    expect(result).toEqual({
      status: 'CONFLICT',
      operationId: 'operation-1',
      conflictId: 'conflict-1',
      sequence: 1,
      version: 3,
    });
    expect(harness.currentDiagram().data).toEqual({
      classes: [{ id: 'class-1', name: 'Original' }],
      relations: [],
    });
    expect(harness.conflicts[0]).toMatchObject({
      baseVersion: 2,
      localData: {
        classes: [{ id: 'class-1', name: 'Variante local' }],
        relations: [],
      },
      remoteData: {
        classes: [{ id: 'class-1', name: 'Original' }],
        relations: [],
      },
      status: 'PENDING',
    });
  });

  it('returns the same conflict when a stale operation is retried', async () => {
    const harness = createHarness();
    const stale = { ...edit, baseVersion: 2 };
    const first = await harness.service.apply(stale);

    const retried = await harness.service.apply(stale);

    expect(retried).toEqual(first);
    expect(harness.operations).toHaveLength(1);
    expect(harness.conflicts).toHaveLength(1);
  });

  it('replays only later events in server sequence order', async () => {
    const harness = createHarness();
    await harness.service.apply(edit);
    await harness.service.apply({
      ...edit,
      clientSequence: 2,
      baseVersion: 4,
      changes: {
        type: 'full_update',
        data: { classes: [], relations: [] },
      },
    });

    const replay = await harness.service.eventsAfter(
      'diagram-1',
      'editor-1',
      1,
    );

    expect(replay.map((item: any) => item.serverSequence)).toEqual([2]);
    expect(harness.authorization.require).toHaveBeenCalledWith(
      'workspace-1',
      'editor-1',
      'diagram:read',
    );
  });

  it('resolves a pending conflict as a new diagram version without deleting variants', async () => {
    const harness = createHarness();
    const conflicted = await harness.service.apply({
      ...edit,
      baseVersion: 2,
      changes: {
        type: 'full_update',
        data: { classes: [], relations: [] },
      },
    });
    const resolution = {
      classes: [{ id: 'class-1', name: 'Combinada' }],
      relations: [],
    };

    const result = await harness.service.resolveConflict(
      conflicted.conflictId!,
      'editor-1',
      resolution,
    );

    expect(result).toMatchObject({
      id: 'conflict-1',
      status: 'RESOLVED',
      resolution,
      resolvedById: 'editor-1',
    });
    expect(harness.currentDiagram()).toMatchObject({
      version: 4,
      data: resolution,
    });
    expect(harness.conflicts[0].localData).toEqual({
      classes: [],
      relations: [],
    });
    expect(harness.conflicts[0].remoteData).toEqual({
      classes: [{ id: 'class-1', name: 'Original' }],
      relations: [],
    });
    expect(harness.audits.at(-1)).toMatchObject({
      action: 'SYNC_CONFLICT_RESOLVED',
      actorId: 'editor-1',
    });
  });
});
