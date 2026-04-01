'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen } from 'lucide-react';
import { InstructionFolderItem, InstructionItem } from '@/lib/api/instructions';
import { cn } from '@/lib/utils';

interface TreeFolderNode extends InstructionFolderItem {
  children: TreeFolderNode[];
}

function buildTree(folders: InstructionFolderItem[]) {
  const map = new Map<string, TreeFolderNode>();
  const roots: TreeFolderNode[] = [];

  folders.forEach((folder) => {
    map.set(folder.id, { ...folder, children: [] });
  });

  map.forEach((node) => {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (nodes: TreeFolderNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    nodes.forEach((node) => sortNodes(node.children));
  };

  sortNodes(roots);
  return roots;
}

function FolderBranch({
  node,
  instructionsByFolder,
  selectedFolderId,
  onSelectFolder,
  depth = 0,
}: {
  node: TreeFolderNode;
  instructionsByFolder: Map<string, InstructionItem[]>;
  selectedFolderId: string;
  onSelectFolder: (folderId: string) => void;
  depth?: number;
}) {
  const hasChildren = node.children.length > 0 || (instructionsByFolder.get(node.id)?.length || 0) > 0;
  const [expanded, setExpanded] = useState(depth < 1 || selectedFolderId === node.id);
  const isSelected = selectedFolderId === node.id;
  const items = instructionsByFolder.get(node.id) || [];

  return (
    <div className="space-y-1">
      <div
        className={cn(
          'flex items-center gap-1 rounded-xl px-2 py-1.5 transition',
          isSelected ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-100',
        )}
        style={{ marginLeft: depth * 14 }}
      >
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-white"
          onClick={() => hasChildren && setExpanded((prev) => !prev)}
        >
          {hasChildren ? (
            expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          ) : (
            <span className="block h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium"
          onClick={() => {
            onSelectFolder(node.id);
            setExpanded(true);
          }}
        >
          {expanded ? <FolderOpen className="h-4 w-4 flex-shrink-0" /> : <Folder className="h-4 w-4 flex-shrink-0" />}
          <span className="truncate">{node.name}</span>
        </button>
      </div>

      {expanded && (
        <div className="space-y-1">
          {items.map((instruction) => (
            <Link
              key={instruction.id}
              href={`/instructions/${instruction.publicId}`}
              className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              style={{ marginLeft: (depth + 1) * 14 + 28 }}
            >
              <FileText className="h-4 w-4 flex-shrink-0 text-slate-400" />
              <span className="truncate">{instruction.title}</span>
            </Link>
          ))}

          {node.children.map((child) => (
            <FolderBranch
              key={child.id}
              node={child}
              instructionsByFolder={instructionsByFolder}
              selectedFolderId={selectedFolderId}
              onSelectFolder={onSelectFolder}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function InstructionTree({
  folders,
  instructions,
  selectedFolderId,
  onSelectFolder,
}: {
  folders: InstructionFolderItem[];
  instructions: InstructionItem[];
  selectedFolderId: string;
  onSelectFolder: (folderId: string) => void;
}) {
  const tree = useMemo(() => buildTree(folders), [folders]);

  const instructionsByFolder = useMemo(() => {
    const map = new Map<string, InstructionItem[]>();
    instructions.forEach((instruction) => {
      if (!instruction.folder?.id) return;
      const current = map.get(instruction.folder.id) || [];
      current.push(instruction);
      current.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
      map.set(instruction.folder.id, current);
    });
    return map;
  }, [instructions]);

  const uncategorized = useMemo(
    () => instructions.filter((instruction) => !instruction.folder?.id).sort((a, b) => a.title.localeCompare(b.title, 'ru')),
    [instructions],
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="text-sm font-semibold text-slate-900">Дерево инструкций</div>
        <div className="mt-1 text-xs text-slate-500">Каталоги и инструкции в текущей выборке.</div>
      </div>

      <div className="max-h-[70vh] overflow-y-auto px-3 py-3">
        <button
          type="button"
          className={cn(
            'mb-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition',
            !selectedFolderId ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-100',
          )}
          onClick={() => onSelectFolder('')}
        >
          <FolderOpen className="h-4 w-4" />
          Все инструкции
        </button>

        {tree.map((node) => (
          <FolderBranch
            key={node.id}
            node={node}
            instructionsByFolder={instructionsByFolder}
            selectedFolderId={selectedFolderId}
            onSelectFolder={onSelectFolder}
          />
        ))}

        {uncategorized.length > 0 && (
          <div className="mt-3 space-y-1">
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition',
                selectedFolderId === '__uncategorized__'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-700 hover:bg-slate-100',
              )}
              onClick={() => onSelectFolder('__uncategorized__')}
            >
              <Folder className="h-4 w-4" />
              Без каталога
            </button>

            {uncategorized.map((instruction) => (
              <Link
                key={instruction.id}
                href={`/instructions/${instruction.publicId}`}
                className="ml-10 flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <FileText className="h-4 w-4 flex-shrink-0 text-slate-400" />
                <span className="truncate">{instruction.title}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
