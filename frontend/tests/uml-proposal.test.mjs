import assert from 'node:assert/strict';
import test from 'node:test';
import { describeUmlProposal, selectUmlProposal } from '../lib/uml-proposal.ts';

const current = {
  classes: [{ id: 'a', name: 'A' }, { id: 'z', name: 'Z' }],
  relations: [{ id: 'old', sourceClassId: 'a', targetClassId: 'z' }],
};
const proposal = {
  classes: [{ id: 'a', name: 'Renamed A' }, { id: 'b', name: 'B' }],
  relations: [{ id: 'new', sourceClassId: 'a', targetClassId: 'b' }],
};

test('describes added and modified UML items without deleting omitted current items', () => {
  assert.deepEqual(describeUmlProposal(current, proposal), [
    { kind: 'class', id: 'a', name: 'Renamed A', status: 'modified' },
    { kind: 'class', id: 'b', name: 'B', status: 'added' },
    { kind: 'relation', id: 'new', name: 'a → b', status: 'added' },
  ]);
});

test('selects a valid subset, retaining unselected classes and relations', () => {
  assert.deepEqual(selectUmlProposal(current, proposal, ['b', 'new']), {
    classes: [{ id: 'a', name: 'A' }, { id: 'z', name: 'Z' }, { id: 'b', name: 'B' }],
    relations: [{ id: 'old', sourceClassId: 'a', targetClassId: 'z' }, { id: 'new', sourceClassId: 'a', targetClassId: 'b' }],
  });
});

test('rejects a selected relation whose new endpoint was not selected', () => {
  assert.throws(() => selectUmlProposal(current, proposal, ['new']), /endpoint/i);
});
