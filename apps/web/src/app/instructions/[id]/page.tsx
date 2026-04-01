'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown, ChevronRight, Copy, ExternalLink, FileDown, FolderOpen, Pencil, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { getAccessToken } from '@/lib/api';
import { InstructionFolderItem, instructionsApi } from '@/lib/api/instructions';
import { useAuthStore } from '@/lib/store/auth.store';
import { cn, formatFileSize, formatRelative } from '@/lib/utils';

interface FolderTreeNode extends InstructionFolderItem {
  children: FolderTreeNode[];
}

function buildFolderTree(folders: InstructionFolderItem[]) {
  const map = new Map<string, FolderTreeNode>();
  const roots: FolderTreeNode[] = [];

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

  const sortNodes = (nodes: FolderTreeNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    nodes.forEach((node) => sortNodes(node.children));
  };

  sortNodes(roots);
  return roots;
}

function extractAttachmentNameFromDisposition(contentDisposition?: string) {
  if (!contentDisposition) {
    return null;
  }

  const utf8Match = contentDisposition.match(/filename\*\=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const plainMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
  if (plainMatch?.[1]) {
    return plainMatch[1];
  }

  return null;
}

function FolderMoveBranch({
  node,
  selectedFolderId,
  onSelect,
  depth = 0,
}: {
  node: FolderTreeNode;
  selectedFolderId: string;
  onSelect: (folderId: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(depth < 1 || selectedFolderId === node.id);
  const hasChildren = node.children.length > 0;

  return (
    <div className="space-y-1">
      <div
        className={cn(
          'flex items-center gap-1 rounded-xl px-2 py-1.5 transition',
          selectedFolderId === node.id ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-100',
        )}
        style={{ marginLeft: depth * 14 }}
      >
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-white"
          onClick={() => hasChildren && setExpanded((value) => !value)}
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
            onSelect(node.id);
            setExpanded(true);
          }}
        >
          <FolderOpen className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">{node.name}</span>
        </button>
      </div>

      {expanded && node.children.map((child) => (
        <FolderMoveBranch
          key={child.id}
          node={child}
          selectedFolderId={selectedFolderId}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

export default function InstructionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const [tokenReady, setTokenReady] = useState(() => !!getAccessToken());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showUsageDialog, setShowUsageDialog] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState('');

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (getAccessToken()) {
      setTokenReady(true);
      return;
    }

    const intervalId = window.setInterval(() => {
      if (getAccessToken()) {
        setTokenReady(true);
        window.clearInterval(intervalId);
      }
    }, 100);

    return () => window.clearInterval(intervalId);
  }, []);

  const canLoadInstruction = isHydrated && isAuthenticated && tokenReady;

  const { data: instruction, isLoading, isError } = useQuery({
    queryKey: ['instruction', id],
    queryFn: () => instructionsApi.getById(id),
    enabled: canLoadInstruction,
  });

  const { data: folders } = useQuery({
    queryKey: ['instruction-folders'],
    queryFn: () => instructionsApi.getFolders(),
    enabled: canLoadInstruction,
  });

  const folderTree = useMemo(() => buildFolderTree(folders || []), [folders]);
  const usageLinks = useMemo(
    () =>
      [...(instruction?.cardLinks || [])]
        .sort(
          (a, b) =>
            new Date(b.card.updatedAt).getTime() - new Date(a.card.updatedAt).getTime(),
        )
        .slice(0, 3),
    [instruction?.cardLinks],
  );

  const deleteMutation = useMutation({
    mutationFn: () => instructionsApi.delete(instruction!.id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['instructions'] }),
        queryClient.invalidateQueries({ queryKey: ['instruction-folders'] }),
      ]);
      toast.success('Инструкция удалена');
      router.push('/instructions');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Не удалось удалить инструкцию');
    },
  });

  const statusMutation = useMutation({
    mutationFn: (nextStatus: 'PUBLISHED' | 'HIDDEN' | 'ARCHIVED') =>
      instructionsApi.update(instruction!.id, { status: nextStatus }),
    onSuccess: async (updated) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['instructions'] }),
        queryClient.invalidateQueries({ queryKey: ['instruction', id] }),
        queryClient.invalidateQueries({ queryKey: ['instruction-folders'] }),
        queryClient.invalidateQueries({ queryKey: ['published-instructions-picker'] }),
      ]);
      toast.success('Статус инструкции обновлён');
      if (updated?.publicId && updated.publicId !== instruction?.publicId) {
        router.replace(`/instructions/${updated.publicId}`);
      }
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Не удалось изменить статус инструкции');
    },
  });

  const moveMutation = useMutation({
    mutationFn: (folderId: string) =>
      instructionsApi.update(instruction!.id, {
        folderId: folderId || undefined,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['instructions'] }),
        queryClient.invalidateQueries({ queryKey: ['instruction', id] }),
        queryClient.invalidateQueries({ queryKey: ['instruction-folders'] }),
      ]);
      toast.success('Инструкция перемещена');
      setShowMoveDialog(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Не удалось переместить инструкцию');
    },
  });

  if (!canLoadInstruction || isLoading) {
    return (
      <AppLayout>
        <div className="page-container-wide">
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="skeleton h-36 rounded-2xl" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (isError || !instruction) {
    return (
      <AppLayout>
        <div className="page-container-wide">
          <div className="section-surface">
            <div className="card-body text-sm text-slate-500">
              Инструкция не найдена или недоступна для просмотра.
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  const canEdit = user?.role === 'ADMIN' || instruction.createdBy.id === user?.id;
  const isAdmin = user?.role === 'ADMIN';
  const pageUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/instructions/${instruction.publicId}`
      : `/instructions/${instruction.publicId}`;

  const downloadAttachment = async (instructionId: string, attachmentId: string, fallbackFileName: string) => {
    try {
      const { blob, contentDisposition } = await instructionsApi.downloadAttachment(instructionId, attachmentId);
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = extractAttachmentNameFromDisposition(contentDisposition) || fallbackFileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Не удалось скачать вложение');
    }
  };

  const handleInstructionContentClick = async (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    const anchor = target?.closest('a');

    if (!anchor?.getAttribute('href')) {
      return;
    }

    const href = anchor.getAttribute('href') || '';
    const resolvedUrl = new URL(href, window.location.origin);
    const match = resolvedUrl.pathname.match(/\/api\/instructions\/([^/]+)\/attachments\/([^/]+)\/download$/i);

    if (!match) {
      return;
    }

    event.preventDefault();

    const [, instructionId, attachmentId] = match;
    const fallbackName =
      instruction.attachments.find((item) => item.id === attachmentId)?.fileName ||
      anchor.textContent?.trim() ||
      'attachment';

    await downloadAttachment(instructionId, attachmentId, fallbackName);
  };

  return (
    <AppLayout>
      <div className="page-container-wide">
        <div className="page-hero">
          <div className="page-hero-body">
            <div className="page-title-row">
              <div className="flex-1 min-w-0">
                <div className="page-kicker">Инструкции</div>
                <div className="mt-3 text-sm font-mono text-slate-400">{instruction.publicId}</div>
                <h1 className="mt-4 text-2xl font-semibold text-slate-900">{instruction.title}</h1>
                <p className="page-subtitle">
                  {instruction.summary || 'Рабочая инструкция для портала «Нормбаза».'}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <span>Автор: {instruction.createdBy.fullName}</span>
                  <span>Обновлено: {formatRelative(instruction.updatedAt)}</span>
                  <span>Вложений: {instruction.attachments.length}</span>
                  <span>Карточек: {instruction.cardLinks.length}</span>
                </div>
              </div>

              <div className="card-action-toolbar">
                <Link href="/instructions" className="toolbar-button toolbar-button-ghost">
                  <ArrowLeft className="h-4 w-4" />
                  К списку
                </Link>
                <button
                  type="button"
                  className="toolbar-button toolbar-button-secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(pageUrl);
                    toast.success('Ссылка на инструкцию скопирована');
                  }}
                >
                  <Copy className="h-4 w-4" />
                  Скопировать ссылку
                </button>
                <Link href={`/instructions/${instruction.publicId}/print`} target="_blank" className="toolbar-button toolbar-button-secondary">
                  <FileDown className="h-4 w-4" />
                  Скачать в PDF
                </Link>
                <button
                  type="button"
                  className="toolbar-button toolbar-button-secondary"
                  onClick={() => setShowUsageDialog(true)}
                >
                  <Search className="h-4 w-4" />
                  Где используется
                  <span className="page-chip px-2 py-0.5 text-[11px]">{instruction.cardLinks.length}</span>
                </button>
                {canEdit && (
                  <button
                    type="button"
                    className="toolbar-button toolbar-button-secondary"
                    onClick={() => {
                      setSelectedFolderId(instruction.folder?.id || '');
                      setShowMoveDialog(true);
                    }}
                  >
                    <FolderOpen className="h-4 w-4" />
                    Переместить
                  </button>
                )}
                {canEdit && instruction.status !== 'PUBLISHED' && (
                  <button
                    type="button"
                    className="toolbar-button toolbar-button-primary"
                    onClick={() => statusMutation.mutate('PUBLISHED')}
                    disabled={statusMutation.isPending}
                  >
                    Опубликовать
                  </button>
                )}
                {canEdit && instruction.status !== 'HIDDEN' && (
                  <button
                    type="button"
                    className="toolbar-button toolbar-button-secondary"
                    onClick={() => statusMutation.mutate('HIDDEN')}
                    disabled={statusMutation.isPending}
                  >
                    Скрыть
                  </button>
                )}
                {canEdit && instruction.status !== 'ARCHIVED' && (
                  <button
                    type="button"
                    className="toolbar-button toolbar-button-secondary"
                    onClick={() => statusMutation.mutate('ARCHIVED')}
                    disabled={statusMutation.isPending}
                  >
                    Архивировать
                  </button>
                )}
                {canEdit && (
                  <Link
                    href={`/instructions/${instruction.publicId}/edit`}
                    className="toolbar-button toolbar-button-secondary toolbar-button-icon"
                    title="Редактировать"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    className="toolbar-button toolbar-button-danger toolbar-button-icon"
                    onClick={() => setShowDeleteConfirm(true)}
                    title="Удалить"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="section-surface">
          <div className="card-body">
            <div
              className="instruction-prose"
              onClick={handleInstructionContentClick}
              dangerouslySetInnerHTML={{ __html: instruction.contentHtml }}
            />
          </div>
        </div>

        <div className="section-surface">
          <div className="section-surface-header">
            <div>
              <div className="section-surface-title">Вложения</div>
              <div className="section-surface-subtitle">Файлы, приложенные к инструкции.</div>
            </div>
          </div>
          <div className="card-body">
            {instruction.attachments.length === 0 ? (
              <div className="text-sm text-slate-500">Вложений пока нет.</div>
            ) : (
              <div className="space-y-3">
                {instruction.attachments.map((attachment) => (
                  <button
                    key={attachment.id}
                    type="button"
                    className="flex w-full flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:border-blue-200 hover:bg-blue-50/50 md:flex-row md:items-center md:justify-between"
                    onClick={() => downloadAttachment(instruction.id, attachment.id, attachment.fileName)}
                  >
                    <div>
                      <div className="font-medium text-slate-800">{attachment.fileName}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {formatFileSize(Number(attachment.fileSize))} • {attachment.uploadedBy?.fullName || 'Пользователь'} • {formatRelative(attachment.createdAt)}
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                      Скачать
                      <ExternalLink className="h-4 w-4" />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Удалить инструкцию?"
        description="Инструкция и её вложения будут удалены безвозвратно."
        confirmLabel="Удалить"
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
      />

      {showMoveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowMoveDialog(false)} />
          <div className="relative mx-4 w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-base font-semibold text-slate-900">Переместить инструкцию</h3>
              <p className="mt-1 text-sm text-slate-500">
                Выбери каталог, в который нужно перенести инструкцию.
              </p>
            </div>

            <div className="px-6 py-5">
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="max-h-[420px] overflow-y-auto px-3 py-3">
                  <button
                    type="button"
                    className={cn(
                      'mb-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition',
                      !selectedFolderId ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-100',
                    )}
                    onClick={() => setSelectedFolderId('')}
                  >
                    <FolderOpen className="h-4 w-4" />
                    Без каталога
                  </button>

                  {folderTree.map((node) => (
                    <FolderMoveBranch
                      key={node.id}
                      node={node}
                      selectedFolderId={selectedFolderId}
                      onSelect={setSelectedFolderId}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowMoveDialog(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => moveMutation.mutate(selectedFolderId)}
                disabled={moveMutation.isPending || selectedFolderId === (instruction.folder?.id || '')}
              >
                {moveMutation.isPending ? 'Перемещаем...' : 'Переместить'}
              </button>
            </div>
          </div>
        </div>
      )}

              {showUsageDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowUsageDialog(false)} />
          <div className="relative mx-4 w-full max-w-3xl rounded-2xl bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-base font-semibold text-slate-900">Где используется инструкция</h3>
              <p className="mt-1 text-sm text-slate-500">
                Три самые актуальные карточки, в которые сейчас вложена эта инструкция.
              </p>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
              {usageLinks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  Инструкция пока не используется ни в одной карточке.
                </div>
              ) : (
                <div className="space-y-3">
                  {usageLinks.map((link) => (
                    <Link
                      key={link.id}
                      href={`/cards/${link.card.publicId}`}
                      className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-blue-200 hover:bg-blue-50/50 md:flex-row md:items-center md:justify-between"
                      onClick={() => setShowUsageDialog(false)}
                    >
                      <div>
                        <div className="font-medium text-slate-800">
                          {link.card.dataSource?.name || 'Без источника'}
                          {link.card.extraTitle ? ` — ${link.card.extraTitle}` : ''}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {link.card.publicId} • Обновлено {formatRelative(link.card.updatedAt)}
                        </div>
                      </div>
                      <span className="text-sm font-medium text-primary">Открыть карточку</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowUsageDialog(false)}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
