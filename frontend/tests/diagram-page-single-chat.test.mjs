import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('diagram page exposes only the editor-owned AI chat and its versioned save path', () => {
  const page = readFileSync(new URL('../app/workspace/[workspaceId]/diagram/[diagramId]/page.tsx', import.meta.url), 'utf8');
  const editor = readFileSync(new URL('../components/editor/UMLEditor.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /<AIChatInterface\b/);
  assert.match(editor, /<AIChatInterface\b/);
  assert.match(editor, /submitDurableSave\(/);
});
