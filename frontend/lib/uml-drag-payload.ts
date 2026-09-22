type UmlDragTemplate = {
  id: string;
  name: string;
  type: string;
  data: Record<string, unknown>;
};

export function serializeUmlDragItem(item: UmlDragTemplate, classId: string): string {
  return JSON.stringify({
    id: item.id,
    name: item.name,
    type: item.type,
    data: { ...item.data, id: classId },
  });
}
