type UmlItem = { id: string; name?: string; sourceClassId?: string; targetClassId?: string; [key: string]: unknown };
export type UmlModel = { classes: UmlItem[]; relations: UmlItem[] };

export function describeUmlProposal(current: UmlModel, proposed: UmlModel) {
  const changes: Array<{ kind: 'class' | 'relation'; id: string; name: string; status: 'added' | 'modified' }> = [];
  for (const kind of ['class', 'relation'] as const) {
    const key = kind === 'class' ? 'classes' : 'relations';
    const previous = new Map(current[key].map((item) => [item.id, item]));
    for (const item of proposed[key]) {
      const old = previous.get(item.id);
      if (old && JSON.stringify(old) === JSON.stringify(item)) continue;
      changes.push({
        kind,
        id: item.id,
        name: item.name || (kind === 'relation' ? `${item.sourceClassId} → ${item.targetClassId}` : item.id),
        status: old ? 'modified' : 'added',
      });
    }
  }
  return changes;
}

export function selectUmlProposal(current: UmlModel, proposed: UmlModel, selectedIds: string[]): UmlModel {
  if (selectedIds.length === 0) throw new Error('Select at least one change');
  const selected = new Set(selectedIds);
  const classes = [...current.classes];
  const relations = [...current.relations];
  for (const item of proposed.classes.filter((entry) => selected.has(entry.id))) {
    const index = classes.findIndex((entry) => entry.id === item.id);
    if (index < 0) classes.push(item); else classes[index] = item;
  }
  const classIds = new Set(classes.map((item) => item.id));
  for (const item of proposed.relations.filter((entry) => selected.has(entry.id))) {
    if (!classIds.has(item.sourceClassId ?? '') || !classIds.has(item.targetClassId ?? '')) {
      throw new Error('Selected relation endpoint is missing. Select its classes too.');
    }
    const index = relations.findIndex((entry) => entry.id === item.id);
    if (index < 0) relations.push(item); else relations[index] = item;
  }
  return { classes, relations };
}
