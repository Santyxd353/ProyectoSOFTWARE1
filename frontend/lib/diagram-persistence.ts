type DiagramNode = {
  position: { x: number; y: number };
  data: Record<string, any>;
};

type DiagramEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: Record<string, any>;
};

export const serializeDiagramData = (
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  userId: string,
  now: () => string = () => new Date().toISOString(),
) => ({
  classes: nodes.map((node) => ({
    ...node.data,
    position: node.position,
  })),
  relations: edges.map((edge) => ({
    id: edge.id,
    sourceClassId: edge.source,
    targetClassId: edge.target,
    type: edge.data?.type || 'ASSOCIATION',
    name: edge.data?.label || '',
    multiplicity: edge.data?.multiplicity
      ? `${edge.data.multiplicity.source || ''}:${edge.data.multiplicity.target || ''}`
      : undefined,
    sourceHandle: edge.sourceHandle || undefined,
    targetHandle: edge.targetHandle || undefined,
    intermediateTable: edge.data?.intermediateTable || undefined,
  })),
  metadata: {
    lastModified: now(),
    modifiedBy: userId,
  },
});
