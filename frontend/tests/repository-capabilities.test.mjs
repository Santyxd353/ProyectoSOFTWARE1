import assert from 'node:assert/strict';
import test from 'node:test';

const { repositoryCapabilities } = await import(
  '../lib/repository-capabilities.ts'
).catch(() => ({}));

test('OWNER puede leer, comentar, restaurar y administrar', () => {
  assert.deepEqual(repositoryCapabilities('OWNER', false), {
    canRead: true,
    canComment: true,
    canRestore: true,
    canManageMembers: true,
  });
});

test('EDITOR puede restaurar pero no administrar miembros', () => {
  assert.deepEqual(repositoryCapabilities('EDITOR', false), {
    canRead: true,
    canComment: true,
    canRestore: true,
    canManageMembers: false,
  });
});

test('VIEWER comenta solo cuando la política está activa', () => {
  assert.deepEqual(repositoryCapabilities('VIEWER', false), {
    canRead: true,
    canComment: false,
    canRestore: false,
    canManageMembers: false,
  });
  assert.equal(repositoryCapabilities('VIEWER', true).canComment, true);
});
