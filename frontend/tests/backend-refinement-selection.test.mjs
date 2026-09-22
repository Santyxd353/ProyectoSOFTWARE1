import assert from 'node:assert/strict';
import test from 'node:test';
import { refinementFiles, toggleRefinementFeature } from '../lib/backend-refinement-selection.ts';

test('shows deterministic file changes for each supported refinement', () => {
  assert.deepEqual(refinementFiles('HEALTH_ENDPOINT'), ['controller/HealthController.java']);
  assert.deepEqual(refinementFiles('REQUEST_LOGGING'), ['config/RequestLoggingFilter.java']);
  assert.deepEqual(refinementFiles('API_DOCUMENTATION'), ['API_DOCUMENTATION.md']);
});

test('toggles only proposed features without altering the proposal', () => {
  const selected = toggleRefinementFeature(['HEALTH_ENDPOINT', 'REQUEST_LOGGING'], 'HEALTH_ENDPOINT');
  assert.deepEqual(selected, ['REQUEST_LOGGING']);
  assert.deepEqual(toggleRefinementFeature(selected, 'HEALTH_ENDPOINT'), ['REQUEST_LOGGING', 'HEALTH_ENDPOINT']);
});
