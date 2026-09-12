import type {
  RepositoryDirectoryNode,
  RepositoryTreeNode,
  RevisionFile,
} from '../types/repository.ts';

function assertSafePath(filePath: string): void {
  if (
    !filePath ||
    filePath.includes('\\') ||
    filePath.startsWith('/') ||
    /^[a-zA-Z]:/.test(filePath) ||
    filePath.split('/').some((segment) => !segment || segment === '..')
  ) {
    throw new Error('Ruta de repositorio insegura');
  }
}

function sortNodes(nodes: RepositoryTreeNode[]): RepositoryTreeNode[] {
  return nodes
    .map((node) =>
      node.kind === 'directory'
        ? { ...node, children: sortNodes(node.children) }
        : node,
    )
    .sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === 'directory' ? -1 : 1;
      return left.name.localeCompare(right.name);
    });
}

export function buildRepositoryTree(files: RevisionFile[]): RepositoryTreeNode[] {
  const root: RepositoryTreeNode[] = [];

  for (const file of files) {
    assertSafePath(file.path);
    const segments = file.path.split('/');
    let level = root;
    let currentPath = '';

    segments.forEach((segment, index) => {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const isFile = index === segments.length - 1;

      if (isFile) {
        level.push({ kind: 'file', name: segment, path: currentPath, file });
        return;
      }

      let directory = level.find(
        (node): node is RepositoryDirectoryNode =>
          node.kind === 'directory' && node.name === segment,
      );
      if (!directory) {
        directory = {
          kind: 'directory',
          name: segment,
          path: currentPath,
          children: [],
        };
        level.push(directory);
      }
      level = directory.children;
    });
  }

  return sortNodes(root);
}
