import assert from 'node:assert/strict';
import test from 'node:test';

const persistence = await import('../lib/diagram-persistence.ts').catch(
  () => ({}),
);

test('serializes explicitly supplied AI nodes instead of stale editor state', () => {
  const nodes = [{
    id: 'class-user',
    position: { x: 120, y: 80 },
    data: {
      id: 'class-user',
      name: 'Usuario',
      attributes: [],
      methods: [],
    },
  }];
  const edges = [{
    id: 'relation-1',
    source: 'class-user',
    target: 'class-project',
    sourceHandle: 'right',
    targetHandle: 'left',
    data: {
      type: 'ASSOCIATION',
      label: 'crea',
      multiplicity: { source: '1', target: '0..*' },
    },
  }];

  const data = persistence.serializeDiagramData?.(
    nodes,
    edges,
    'user-1',
    () => '2026-09-22T20:00:00.000Z',
  );

  assert.deepEqual(data, {
    classes: [{
      id: 'class-user',
      name: 'Usuario',
      attributes: [],
      methods: [],
      position: { x: 120, y: 80 },
    }],
    relations: [{
      id: 'relation-1',
      sourceClassId: 'class-user',
      targetClassId: 'class-project',
      type: 'ASSOCIATION',
      name: 'crea',
      multiplicity: '1:0..*',
      sourceHandle: 'right',
      targetHandle: 'left',
      intermediateTable: undefined,
    }],
    metadata: {
      lastModified: '2026-09-22T20:00:00.000Z',
      modifiedBy: 'user-1',
    },
  });
});
