import { CollaborationOperationService } from './collaboration-operation.service';

describe('CollaborationOperationService', () => {
  function createHarness() {
    let diagram = {
      id: 'diagram-1',
      workspaceId: 'workspace-1',
      version: 3,
      archivedAt: null as Date | null,
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
        findFirst: jest.fn(async ({ where }: any) =>
          operations.find((item) =>
            item.diagramId === where.diagramId &&
            item.baseVersion === where.baseVersion &&
            item.status === where.status,
          ) ?? null,
        ),
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
      archiveDiagram: () => { diagram = { ...diagram, archivedAt: new Date('2026-09-22T12:00:00Z') }; },
    };
  }

  const edit = {
    diagramId: 'diagram-1',
    userId: 'editor-1',
    deviceId: 'browser-abc',
    clientSequence: 1,
    baseVersion: 3,
    baseData: { classes: [{ id: 'class-1', name: 'Original' }], relations: [] },
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

  it('rejects durable edits after a diagram is archived', async () => {
    const harness = createHarness();
    harness.archiveDiagram();

    await expect(harness.service.apply(edit)).rejects.toThrow(
      'Archived diagrams cannot be edited',
    );
    expect(harness.operations).toHaveLength(0);
  });

  it('does not disclose a different diagram through a colliding device sequence', async () => {
    const harness = createHarness();
    harness.operations.push({
      id: 'foreign-operation', diagramId: 'foreign-diagram', authorId: 'intruder',
      deviceId: edit.deviceId, clientSequence: edit.clientSequence,
      serverSequence: 1, resultVersion: 99, status: 'APPLIED',
      afterData: { classes: [{ id: 'secret', name: 'Private' }], relations: [] },
    });
    await expect(harness.service.apply(edit)).rejects.toThrow('Device sequence already used');
  });

  it('automatically merges independent stale class additions using the server baseline', async () => {
    const harness = createHarness();
    await harness.service.apply({
      ...edit,
      changes: { type: 'full_update', data: {
        classes: [
          { id: 'class-1', name: 'Original' },
          { id: 'remote', name: 'Remota' },
        ],
        relations: [],
      } },
    });

    const result = await harness.service.apply({
      ...edit,
      deviceId: 'android-1',
      changes: { type: 'full_update', data: {
        classes: [
          { id: 'class-1', name: 'Original' },
          { id: 'local', name: 'Local' },
        ],
        relations: [],
      } },
    });

    expect(result.status).toBe('APPLIED');
    expect(result).toMatchObject({ autoMerged: true, data: {
      classes: [
        { id: 'class-1', name: 'Original' },
        { id: 'remote', name: 'Remota' },
        { id: 'local', name: 'Local' },
      ],
    } });
    expect(harness.currentDiagram().version).toBe(5);
    expect(harness.currentDiagram().data.classes).toEqual([
      { id: 'class-1', name: 'Original' },
      { id: 'remote', name: 'Remota' },
      { id: 'local', name: 'Local' },
    ]);
    expect(harness.conflicts).toHaveLength(0);
  });

  it('rejects automatic merging when an optimistic client baseline differs from server history', async () => {
    const harness = createHarness();
    await harness.service.apply({ ...edit, changes: { type: 'full_update', data: {
      classes: [{ id: 'class-1', name: 'Original' }, { id: 'remote', name: 'Remote' }], relations: [],
    } } });
    const result = await harness.service.apply({
      ...edit, deviceId: 'android-1', baseData: { classes: [], relations: [] },
      changes: { type: 'full_update', data: {
        classes: [{ id: 'class-1', name: 'Original' }, { id: 'local', name: 'Local' }], relations: [],
      } },
    });
    expect(result.status).toBe('CONFLICT');
    expect(harness.currentDiagram().data.classes).not.toContainEqual({ id: 'local', name: 'Local' });
  });

  it('preserves remote classes across two sequential offline edits with one confirmed baseline', async () => {
    const harness = createHarness();
    await harness.service.apply({ ...edit, changes: { type: 'full_update', data: {
      classes: [{ id: 'class-1', name: 'Original' }, { id: 'remote-b', name: 'B' }], relations: [],
    } } });
    await harness.service.apply({ ...edit, clientSequence: 2, baseVersion: 4,
      baseData: { classes: [{ id: 'class-1', name: 'Original' }, { id: 'remote-b', name: 'B' }], relations: [] },
      changes: { type: 'full_update', data: {
        classes: [{ id: 'class-1', name: 'Original' }, { id: 'remote-b', name: 'B' }, { id: 'remote-d', name: 'D' }], relations: [],
      } },
    });
    const first = await harness.service.apply({ ...edit, deviceId: 'android-1', changes: { type: 'full_update', data: {
      classes: [{ id: 'class-1', name: 'Original' }, { id: 'local-a', name: 'A' }], relations: [],
    } } });
    const second = await harness.service.apply({ ...edit, deviceId: 'android-1', clientSequence: 2,
      changes: { type: 'full_update', data: {
        classes: [{ id: 'class-1', name: 'Original' }, { id: 'local-a', name: 'A' }, { id: 'local-c', name: 'C' }], relations: [],
      } },
    });
    expect(first.status).toBe('APPLIED');
    expect(second.status).toBe('APPLIED');
    expect(harness.currentDiagram().data.classes.map((item: any) => item.id)).toEqual([
      'class-1', 'remote-b', 'remote-d', 'local-a', 'local-c',
    ]);
  });

  it('returns the merged snapshot when an automatically merged operation is retried', async () => {
    const harness = createHarness();
    await harness.service.apply({ ...edit, changes: { type: 'full_update', data: {
      classes: [{ id: 'class-1', name: 'Original' }, { id: 'remote', name: 'Remote' }], relations: [],
    } } });
    const stale = { ...edit, deviceId: 'android-1', changes: { type: 'full_update' as const, data: {
      classes: [{ id: 'class-1', name: 'Original' }, { id: 'local', name: 'Local' }], relations: [],
    } } };
    await harness.service.apply(stale);
    const retry = await harness.service.apply(stale);
    expect(retry).toMatchObject({ status: 'DUPLICATE', autoMerged: true, data: {
      classes: [
        { id: 'class-1', name: 'Original' },
        { id: 'remote', name: 'Remote' },
        { id: 'local', name: 'Local' },
      ],
    } });
  });

  it('merges independent properties but keeps overlapping edits as conflicts', async () => {
    const harness = createHarness();
    await harness.service.apply({ ...edit, changes: { type: 'full_update', data: {
      classes: [{ id: 'class-1', name: 'Original', description: 'Remota' }],
      relations: [],
    } } });
    const independent = await harness.service.apply({
      ...edit, deviceId: 'android-1', changes: { type: 'full_update', data: {
        classes: [{ id: 'class-1', name: 'Local' }], relations: [],
      } },
    });
    expect(independent.status).toBe('APPLIED');
    expect(harness.currentDiagram().data.classes[0]).toEqual({
      id: 'class-1', name: 'Local', description: 'Remota',
    });

    const overlapping = await harness.service.apply({
      ...edit, deviceId: 'android-2', changes: { type: 'full_update', data: {
        classes: [{ id: 'class-1', name: 'Otra' }], relations: [],
      } },
    });
    expect(overlapping.status).toBe('CONFLICT');
    expect(harness.currentDiagram().data.classes[0].name).toBe('Local');
  });

  it('does not merge a relation to a class removed remotely', async () => {
    const harness = createHarness();
    await harness.service.apply({ ...edit, changes: { type: 'full_update', data: {
      classes: [], relations: [],
    } } });
    const result = await harness.service.apply({
      ...edit, deviceId: 'android-1', changes: { type: 'full_update', data: {
        classes: [{ id: 'class-1', name: 'Original' }],
        relations: [{ id: 'relation-1', sourceClassId: 'class-1', targetClassId: 'class-1' }],
      } },
    });
    expect(result.status).toBe('CONFLICT');
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

  it('preserves edits made after conflict creation when resolving it', async () => {
    const harness = createHarness();
    const conflicted = await harness.service.apply({
      ...edit,
      baseVersion: 2,
      changes: { type: 'full_update', data: {
        classes: [{ id: 'class-1', name: 'Local' }], relations: [],
      } },
    });
    await harness.service.apply({
      ...edit,
      clientSequence: 2,
      changes: { type: 'full_update', data: {
        classes: [
          { id: 'class-1', name: 'Original' },
          { id: 'class-2', name: 'Nueva remota' },
        ],
        relations: [],
      } },
    });

    await harness.service.resolveConflict(conflicted.conflictId!, 'editor-1', {
      classes: [{ id: 'class-1', name: 'Combinada' }], relations: [],
    });

    expect(harness.currentDiagram().data.classes).toEqual([
      { id: 'class-1', name: 'Combinada' },
      { id: 'class-2', name: 'Nueva remota' },
    ]);
  });

  it('rejects conflict resolution after a diagram is archived', async () => {
    const harness = createHarness();
    const conflicted = await harness.service.apply({ ...edit, baseVersion: 2 });
    harness.archiveDiagram();

    await expect(harness.service.resolveConflict(
      conflicted.conflictId!, 'editor-1', edit.changes.data,
    )).rejects.toThrow('Archived diagrams cannot be edited');
    expect(harness.conflicts[0].status).toBe('PENDING');
  });
});
