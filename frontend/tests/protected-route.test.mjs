import assert from 'node:assert/strict';
import test from 'node:test';

import { protectedRouteState } from '../lib/protected-route.ts';

test('waits for persisted authentication before redirecting', () => {
  assert.equal(protectedRouteState(false, null), 'pending');
});

test('redirects only after hydration confirms there is no user', () => {
  assert.equal(protectedRouteState(true, null), 'redirect');
});

test('loads a protected route after restoring its user', () => {
  assert.equal(protectedRouteState(true, { id: 'user-1' }), 'ready');
});
