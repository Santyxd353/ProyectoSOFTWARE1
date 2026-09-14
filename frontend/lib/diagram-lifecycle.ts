import type { Diagram } from '../types/uml.ts';
import type { Workspace } from '../types/workspace.ts';

const normalizeDiagram = (diagram: Diagram): Diagram => ({
  ...diagram,
  data: diagram.data || { classes: [], relations: [] },
});

export const normalizeWorkspaceDiagrams = (
  workspace: Pick<Workspace, 'diagrams' | 'archivedDiagrams'>,
) => ({
  diagrams: (workspace.diagrams || []).map(normalizeDiagram),
  archivedDiagrams: (workspace.archivedDiagrams || []).map(normalizeDiagram),
});

export const moveDiagramToArchive = (
  diagrams: Diagram[],
  archivedDiagrams: Diagram[],
  diagramId: string,
) => {
  const diagram = diagrams.find((candidate) => candidate.id === diagramId);
  return {
    diagrams: diagrams.filter((candidate) => candidate.id !== diagramId),
    archivedDiagrams: diagram ? [diagram, ...archivedDiagrams] : archivedDiagrams,
  };
};

export const restoreDiagramInState = (
  diagrams: Diagram[],
  archivedDiagrams: Diagram[],
  diagramId: string,
) => {
  const diagram = archivedDiagrams.find((candidate) => candidate.id === diagramId);
  return {
    diagrams: diagram ? [diagram, ...diagrams] : diagrams,
    archivedDiagrams: archivedDiagrams.filter((candidate) => candidate.id !== diagramId),
  };
};
