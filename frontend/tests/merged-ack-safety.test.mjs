import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('a merged acknowledgement never reloads while local edits may be debounced', () => {
  const source = readFileSync(new URL('../components/editor/UMLEditor.tsx', import.meta.url), 'utf8');
  const branch = source.split('if (acknowledgement.autoMerged && acknowledgement.data) {')[1]
    .split('return;')[0];
  assert.doesNotMatch(branch, /window\.location\.reload\(\)/);
});
