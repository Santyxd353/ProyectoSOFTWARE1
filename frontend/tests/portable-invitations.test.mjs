import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const apiSource = await readFile(new URL('../lib/api.ts', import.meta.url), 'utf8');
const memberSource = await readFile(
  new URL('../components/workspace/MemberManagement.tsx', import.meta.url),
  'utf8',
);

test('workspace API exposes portable invitation creation and claim contracts', () => {
  assert.match(apiSource, /createPortableInvitation/);
  assert.match(apiSource, /\/workspaces\/\$\{workspaceId\}\/invitations\/portable/);
  assert.match(apiSource, /claimPortableInvitation/);
  assert.match(apiSource, /\/workspaces\/invitations\/claim/);
});

test('member management exposes role, expiration, copyable link and code controls', () => {
  for (const contract of [
    'portable-role',
    'portable-expiry',
    'portable-email',
    'portable-link',
    'portable-code',
  ]) {
    assert.match(memberSource, new RegExp(contract));
  }
  assert.match(memberSource, /navigator\.clipboard\.writeText/);
});
