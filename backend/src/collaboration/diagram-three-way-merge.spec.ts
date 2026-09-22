import { mergeDiagram } from './diagram-three-way-merge';

describe('mergeDiagram', () => {
  it('keeps remote metadata while merging independent structural edits', () => {
    const base = { classes: [{ id: 'a', name: 'A' }], relations: [], metadata: { lastModified: 'old' } };
    const local = { classes: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], relations: [], metadata: { lastModified: 'local' } };
    const remote = { classes: [{ id: 'a', name: 'A' }, { id: 'c', name: 'C' }], relations: [], metadata: { lastModified: 'remote' } };
    expect(mergeDiagram(base, local, remote)).toEqual({
      classes: [{ id: 'a', name: 'A' }, { id: 'c', name: 'C' }, { id: 'b', name: 'B' }],
      relations: [],
      metadata: { lastModified: 'remote' },
    });
  });
});
