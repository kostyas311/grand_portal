'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Folder,
  FolderOpen,
  Plus,
  Search,
  Unlink2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { InstructionFolderItem, InstructionItem, instructionsApi } from '@/lib/api/instructions';
import { formatRelative, cn } from '@/lib/utils';

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

function SelectableFolderBranch({
  node,
  instructionsByFolder,
  attachedInstructionIds,
  onAttach,
  onOpenInstruction,
  search,
  depth = 0,
}: {
  node: TreeFolderNode;
  instructionsByFolder: Map<string, InstructionItem[]>;
  attachedInstructionIds: Set<string>;
  onAttach: (instructionId: string) => void;
  onOpenInstruction: (publicId: string) => void;
  search: string;
  depth?: number;
}) {
  const items = instructionsByFolder.get(node.id) || [];
  const nestedContentExists = node.children.length > 0 || items.length > 0;
  const [expanded, setExpanded] = useState(depth < 1 || !!search);

  return (
    <div className="space-y-1">
      <div
        className="flex items-center gap-1 rounded-xl px-2 py-1.5 text-slate-700 transition hover:bg-slate-100"
        style={{ marginLeft: depth * 14 }}
      >
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-white"
          onClick={() => nestedContentExists && setExpanded((prev) => !prev)}
        >
          {nestedContentExists ? (
            expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          ) : (
            <span className="block h-4 w-4" />
          )}
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
          {expanded ? <FolderOpen className="h-4 w-4 flex-shrink-0" /> : <Folder className="h-4 w-4 flex-shrink-0" />}
          <span className="truncate">{node.name}</span>
        </div>
      </div>

      {expanded && (
        <div className="space-y-1">
          {items.map((instruction) => {
            const isAttached = attachedInstructionIds.has(instruction.id);
            return (
              <div
                key={instruction.id}
                className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-slate-100"
                style={{ marginLeft: (depth + 1) * 14 + 28 }}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm text-slate-600"
                  onClick={() => onOpenInstruction(instruction.publicId)}
                >
                  <FileText className="h-4 w-4 flex-shrink-0 text-slate-400" />
                  <span className="truncate">{instruction.title}</span>
                </button>
                <button
                  type="button"
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg border transition',
                    isAttached
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100',
                  )}
                  onClick={() => !isAttached && onAttach(instruction.id)}
                  disabled={isAttached}
                  title={isAttached ? 'Инструкция уже вложена' : 'Вложить инструкцию'}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            );
          })}

          {node.children.map((child) => (
            <SelectableFolderBranch
              key={child.id}
              node={child}
              instructionsByFolder={instructionsByFolder}
              attachedInstructionIds={attachedInstructionIds}
              onAttach={onAttach}
              onOpenInstruction={onOpenInstruction}
              search={search}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CardInstructionsSidebar({
  cardId,
  isOpen,
  onClose,
  linkedInstructions,
  canManage,
}: {
  cardId: string;
  isOpen: boolean;
  onClose: () => void;
  linkedInstructions: Array<{
    id: string;
    createdAt: string;
    instruction: InstructionItem;
  }>;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'linked' | 'tree'>('linked');

  const { data: folders } = useQuery({
    queryKey: ['instruction-folders'],
    queryFn: () => instructionsApi.getFolders(),
    enabled: isOpen && canManage,
  });

  const { data: publishedInstructions } = useQuery({
    queryKey: ['published-instructions-for-card', search],
    queryFn: () => instructionsApi.getPublished(),
    enabled: isOpen && canManage,
  });

  const attachMutation = useMutation({
    mutationFn: (instructionId: string) => instructionsApi.attachToCard(cardId, instructionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['card-instructions', cardId] });
      toast.success('Инструкция вложена в карточку');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Не удалось вложить инструкцию');
    },
  });

  const detachMutation = useMutation({
    mutationFn: (instructionId: string) => instructionsApi.detachFromCard(cardId, instructionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['card-instructions', cardId] });
      toast.success('Инструкция убрана из карточки');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Не удалось убрать инструкцию');
    },
  });

  const filteredInstructions = useMemo(() => {
    const items = publishedInstructions || [];
    if (!search.trim()) {
      return items;
    }
    const normalized = search.trim().toLowerCase();
    return items.filter((instruction) =>
      [instruction.title, instruction.summary || '', instruction.publicId, instruction.folder?.name || '']
        .join(' ')
        .toLowerCase()
        .includes(normalized),
    );
  }, [publishedInstructions, search]);

  const tree = useMemo(() => buildTree(folders || []), [folders]);
  const instructionsByFolder = useMemo(() => {
    const map = new Map<string, InstructionItem[]>();
    filteredInstructions.forEach((instruction) => {
      if (!instruction.folder?.id) return;
      const current = map.get(instruction.folder.id) || [];
      current.push(instruction);
      current.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
      map.set(instruction.folder.id, current);
    });
    return map;
  }, [filteredInstructions]);
  const uncategorized = useMemo(
    () =>
      filteredInstructions
        .filter((instruction) => !instruction.folder?.id)
        .sort((a, b) => a.title.localeCompare(b.title, 'ru')),
    [filteredInstructions],
  );
  const attachedInstructionIds = useMemo(
    () => new Set(linkedInstructions.map((item) => item.instruction.id)),
    [linkedInstructions],
  );

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 bg-slate-950/10 lg:bg-transparent" onClick={onClose} />}
      <aside
        className={cn(
          'fixed bottom-4 right-4 top-20 z-50 w-[380px] max-w-[calc(100vw-32px)] rounded-3xl border border-slate-200 bg-white shadow-2xl transition-transform duration-200',
          isOpen ? 'translate-x-0' : 'translate-x-[110%]',
        )}
      >
        <div className="flex h-full flex-col overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <BookOpen className="h-4 w-4 text-slate-500" />
                  Инструкции карточки
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Боковая панель для быстрого выбора, открытия и вложения инструкций.
                </div>
              </div>
              <button
                type="button"
                className="btn-icon h-9 w-9 border border-slate-200 bg-white text-slate-500"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-medium transition',
                  tab === 'linked' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
                onClick={() => setTab('linked')}
              >
                Вложенные
              </button>
              {canManage && (
                <button
                  type="button"
                  className={cn(
                    'rounded-full px-4 py-2 text-sm font-medium transition',
                    tab === 'tree' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                  onClick={() => setTab('tree')}
                >
                  Каталог
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {tab === 'linked' ? (
              !linkedInstructions.length ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
                  Инструкции пока не вложены.
                </div>
              ) : (
                <div className="space-y-3">
                  {linkedInstructions.map((link) => (
                    <div key={link.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="page-chip font-mono">{link.instruction.publicId}</span>
                        {link.instruction.folder && <span className="page-chip">{link.instruction.folder.name}</span>}
                        <span className="text-xs text-slate-400">{formatRelative(link.createdAt)}</span>
                      </div>
                      <div className="mt-3 text-sm font-semibold text-slate-900">{link.instruction.title}</div>
                      {link.instruction.summary && (
                        <p className="mt-1 text-sm text-slate-500">{link.instruction.summary}</p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Link
                          href={`/instructions/${link.instruction.publicId}`}
                          target="_blank"
                          className="btn-secondary"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Открыть
                        </Link>
                        {canManage && (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => detachMutation.mutate(link.instruction.id)}
                            disabled={detachMutation.isPending}
                          >
                            <Unlink2 className="h-4 w-4" />
                            Убрать
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    className="input pl-9"
                    placeholder="Поиск по инструкциям..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="max-h-[calc(100vh-260px)] overflow-y-auto px-3 py-3">
                    {tree.map((node) => (
                      <SelectableFolderBranch
                        key={node.id}
                        node={node}
                        instructionsByFolder={instructionsByFolder}
                        attachedInstructionIds={attachedInstructionIds}
                        onAttach={(instructionId) => attachMutation.mutate(instructionId)}
                        onOpenInstruction={(publicId) => window.open(`/instructions/${publicId}`, '_blank', 'noopener,noreferrer')}
                        search={search}
                      />
                    ))}

                    {uncategorized.length > 0 && (
                      <div className="mt-3 space-y-1">
                        <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-700">
                          <Folder className="h-4 w-4" />
                          Без каталога
                        </div>
                        {uncategorized.map((instruction) => {
                          const isAttached = attachedInstructionIds.has(instruction.id);
                          return (
                            <div
                              key={instruction.id}
                              className="ml-10 flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-slate-100"
                            >
                              <button
                                type="button"
                                className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm text-slate-600"
                                onClick={() => window.open(`/instructions/${instruction.publicId}`, '_blank', 'noopener,noreferrer')}
                              >
                                <FileText className="h-4 w-4 flex-shrink-0 text-slate-400" />
                                <span className="truncate">{instruction.title}</span>
                              </button>
                              <button
                                type="button"
                                className={cn(
                                  'flex h-8 w-8 items-center justify-center rounded-lg border transition',
                                  isAttached
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100',
                                )}
                                onClick={() => !isAttached && attachMutation.mutate(instruction.id)}
                                disabled={isAttached}
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {!tree.length && !uncategorized.length && (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
                        Опубликованные инструкции не найдены.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
