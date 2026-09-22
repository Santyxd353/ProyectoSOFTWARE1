import assert from 'node:assert/strict';
import test from 'node:test';

const dragPayload = await import('../lib/uml-drag-payload.ts').catch(() => ({}));

test('serializes a sidebar class without its circular React icon', () => {
  const icon = { kind: 'react-icon' };
  icon.owner = { icon };
  const item = {
    id: 'basic-class',
    name: 'Clase',
    type: 'umlClass',
    icon,
    data: { id: 'class_old', name: 'NuevaClase', attributes: [], methods: [] },
  };

  const serialized = dragPayload.serializeUmlDragItem?.(item, 'class_new');

  assert.equal(typeof serialized, 'string');
  assert.deepEqual(JSON.parse(serialized), {
    id: 'basic-class',
    name: 'Clase',
    type: 'umlClass',
    data: { id: 'class_new', name: 'NuevaClase', attributes: [], methods: [] },
  });
});
