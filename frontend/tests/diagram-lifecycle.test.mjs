import assert from 'node:assert/strict';
import test from 'node:test';

const lifecycle = await import('../lib/diagram-lifecycle.ts').catch(() => ({}));

const active = { id: 'active', name: 'Active', data: null };
const archived = { id: 'archived', name: 'Archived', data: null };

test('normalizes active and archived diagrams independently', () => {
  const result = lifecycle.normalizeWorkspaceDiagrams?.({
    diagrams: [active],
    archivedDiagrams: [archived],
  });

  assert.deepEqual(result?.diagrams[0].data, { classes: [], relations: [] });
  assert.deepEqual(result?.archivedDiagrams[0].data, { classes: [], relations: [] });
});

test('moves an archived diagram out of the active collection', () => {
  const result = lifecycle.moveDiagramToArchive?.([active], [], active.id);

  assert.deepEqual(result?.diagrams, []);
  assert.deepEqual(result?.archivedDiagrams.map((diagram) => diagram.id), ['active']);
});

test('restores a diagram to the active collection', () => {
  const result = lifecycle.restoreDiagramInState?.([], [archived], archived.id);

  assert.deepEqual(result?.diagrams.map((diagram) => diagram.id), ['archived']);
  assert.deepEqual(result?.archivedDiagrams, []);
});
