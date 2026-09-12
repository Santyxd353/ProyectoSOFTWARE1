'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, FileCode2, Folder } from 'lucide-react';
import { RepositoryTreeNode } from '@/types/repository';

interface FileTreeProps {
  nodes: RepositoryTreeNode[];
  selectedFileId?: string;
  onSelect: (fileId: string) => void;
}

function TreeLevel({ nodes, selectedFileId, onSelect }: FileTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(nodes.filter((node) => node.kind === 'directory').map((node) => node.path)),
  );

  return (
    <ul className="space-y-0.5" role="tree">
      {nodes.map((node) => {
        if (node.kind === 'directory') {
          const isOpen = expanded.has(node.path);
          return (
            <li key={node.path} role="treeitem" aria-expanded={isOpen}>
              <button
                type="button"
                onClick={() => setExpanded((current) => {
                  const next = new Set(current);
                  if (next.has(node.path)) next.delete(node.path);
                  else next.add(node.path);
                  return next;
                })}
                className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <Folder size={16} className="text-primary" />
                <span className="truncate" title={node.name}>{node.name}</span>
              </button>
              {isOpen && (
                <div className="ml-4 border-l border-border pl-2">
                  <TreeLevel
                    nodes={node.children}
                    selectedFileId={selectedFileId}
                    onSelect={onSelect}
                  />
                </div>
              )}
            </li>
          );
        }

        const selected = selectedFileId === node.file.id;
        return (
          <li key={node.path} role="treeitem" aria-selected={selected}>
            <button
              type="button"
              onClick={() => onSelect(node.file.id)}
              className={`flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                selected ? 'bg-primary/10 font-medium text-primary' : 'text-foreground hover:bg-muted'
              }`}
            >
              <FileCode2 size={16} />
              <span className="truncate" title={node.name}>{node.name}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default function FileTree(props: FileTreeProps) {
  return <TreeLevel {...props} />;
}
