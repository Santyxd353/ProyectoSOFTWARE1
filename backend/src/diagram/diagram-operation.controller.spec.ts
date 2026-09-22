import { DiagramController } from './diagram.controller';

describe('DiagramController REST collaboration broadcast', () => {
  const body = {
    deviceId: 'android-1', clientSequence: 1, baseVersion: 3,
    changes: { type: 'full_update' as const, data: { classes: [{ id: 'local' }], relations: [] } },
  };

  it('broadcasts the persisted server snapshot after a mobile REST operation', async () => {
    const order: string[] = [];
    const merged = { classes: [{ id: 'remote' }, { id: 'local' }], relations: [] };
    const operations = { apply: jest.fn(async () => {
      order.push('persist');
      return { status: 'APPLIED', sequence: 4, version: 5, autoMerged: true, data: merged };
    }) };
    const realtime = { emitDiagramChange: jest.fn(() => order.push('broadcast')) };
    const controller = new DiagramController({} as any, {} as any, operations as any, realtime as any);

    await controller.applyOperation('diagram-1', body as any, { user: { userId: 'user-1' } });

    expect(order).toEqual(['persist', 'broadcast']);
    expect(realtime.emitDiagramChange).toHaveBeenCalledWith('diagram-1', expect.objectContaining({
      changes: { type: 'full_update', data: merged }, version: 5,
    }));
  });

  it('does not broadcast a retried duplicate', async () => {
    const operations = { apply: jest.fn().mockResolvedValue({ status: 'DUPLICATE', sequence: 4, version: 5 }) };
    const realtime = { emitDiagramChange: jest.fn() };
    const controller = new DiagramController({} as any, {} as any, operations as any, realtime as any);
    await controller.applyOperation('diagram-1', body as any, { user: { userId: 'user-1' } });
    expect(realtime.emitDiagramChange).not.toHaveBeenCalled();
  });
});
