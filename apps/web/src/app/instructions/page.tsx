'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { BookText, ExternalLink, Plus, Search } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { InstructionTree } from '@/components/instructions/InstructionTree';
import { EmptyState } from '@/components/shared/EmptyState';
import { getAccessToken } from '@/lib/api';
import { InstructionStatusBadge } from '@/components/instructions/InstructionStatusBadge';
import { InstructionStatus, instructionsApi } from '@/lib/api/instructions';
import { useAuthStore } from '@/lib/store/auth.store';
import { formatRelative } from '@/lib/utils';

const STATUS_FILTERS: Array<{ value: 'ALL' | InstructionStatus; label: string }> = [
  { value: 'ALL', label: 'Все доступные' },
  { value: 'PUBLISHED', label: 'Опубликованные' },
  { value: 'DRAFT', label: 'Черновики' },
  { value: 'HIDDEN', label: 'Скрытые' },
  { value: 'ARCHIVED', label: 'Архивные' },
];

export default function InstructionsPage() {
  const { user, isAuthenticated } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const [tokenReady, setTokenReady] = useState(() => !!getAccessToken());
  const [search, setSearch] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState('');
  const [status, setStatus] = useState<'ALL' | InstructionStatus>('ALL');
  const [mineOnly, setMineOnly] = useState(false);

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

  const canLoadInstructions = isHydrated && isAuthenticated && tokenReady;

  const { data: folders } = useQuery({
    queryKey: ['instruction-folders'],
    queryFn: () => instructionsApi.getFolders(),
    enabled: canLoadInstructions,
  });

  const { data: instructions, isLoading, isError } = useQuery({
    queryKey: ['instructions', search, status, mineOnly],
    queryFn: () =>
      instructionsApi.getAll({
        search: search || undefined,
        status: status === 'ALL' ? undefined : status,
        mineOnly,
      }),
    enabled: canLoadInstructions,
  });

  const descendantFolderIds = useMemo(() => {
    if (!selectedFolderId || !folders?.length) {
      return [];
    }

    const childMap = new Map<string, string[]>();
    folders.forEach((folder) => {
      const parentKey = folder.parentId || '__root__';
      const current = childMap.get(parentKey) || [];
      current.push(folder.id);
      childMap.set(parentKey, current);
    });

    const result = new Set<string>();
    const stack = [selectedFolderId];
    while (stack.length) {
      const current = stack.pop()!;
      result.add(current);
      (childMap.get(current) || []).forEach((childId) => stack.push(childId));
    }

    return Array.from(result);
  }, [folders, selectedFolderId]);

  const visibleInstructions = useMemo(() => {
    const items = instructions || [];
    if (!selectedFolderId) {
      return items;
    }

    if (selectedFolderId === '__uncategorized__') {
      return items.filter((instruction) => !instruction.folder?.id);
    }

    return items.filter(
      (instruction) => instruction.folder?.id && descendantFolderIds.includes(instruction.folder.id),
    );
  }, [instructions, selectedFolderId, descendantFolderIds]);

  const stats = useMemo(() => {
    const items = instructions || [];
    return {
      total: items.length,
      published: items.filter((item) => item.status === 'PUBLISHED').length,
      own: items.filter((item) => item.createdBy.id === user?.id).length,
    };
  }, [instructions, user?.id]);

  return (
    <AppLayout>
      <div className="page-container-wide">
        <div className="page-hero">
          <div className="page-hero-body">
            <div className="page-title-row">
              <div className="flex-1 min-w-0">
                <div className="page-kicker">База знаний</div>
                <h1 className="mt-3 text-2xl font-semibold text-slate-900">Инструкции</h1>
                <p className="page-subtitle">
                  Текстовые инструкции по обработке данных, регламентам и рабочим сценариям. Опубликованные материалы видны всем пользователям портала.
                </p>
              </div>
              <div className="card-action-toolbar">
                <Link href="/instructions/new" className="toolbar-button toolbar-button-primary">
                  <Plus className="h-4 w-4" />
                  Новая инструкция
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Всего</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{stats.total}</div>
            <div className="mt-1 text-sm text-slate-500">в текущей выборке</div>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">Опубликовано</div>
            <div className="mt-2 text-3xl font-semibold text-emerald-800">{stats.published}</div>
            <div className="mt-1 text-sm text-emerald-700">доступно всем сотрудникам</div>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Мои</div>
            <div className="mt-2 text-3xl font-semibold text-blue-800">{stats.own}</div>
            <div className="mt-1 text-sm text-blue-700">инструкций создано вами</div>
          </div>
        </div>

        <div className="section-surface mb-6">
          <div className="card-body space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="input pl-9"
                  placeholder="Поиск по названию, содержимому или коду..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <button
                type="button"
                className={`btn-secondary ${mineOnly ? 'toolbar-button-active' : ''}`}
                onClick={() => setMineOnly((prev) => !prev)}
              >
                Только мои
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {STATUS_FILTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setStatus(item.value)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    status === item.value
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!canLoadInstructions || isLoading ? (
          <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="skeleton h-[520px] rounded-2xl" />
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="skeleton h-40 rounded-2xl" />
              ))}
            </div>
          </div>
        ) : isError ? (
          <div className="section-surface">
            <div className="card-body text-sm text-slate-500">
              Не удалось загрузить инструкции. Обнови страницу ещё раз.
            </div>
          </div>
        ) : !instructions?.length ? (
          <EmptyState
            icon={BookText}
            title="Инструкции не найдены"
            description="Создай первую инструкцию или измени фильтры."
            action={
              <Link href="/instructions/new" className="btn-primary">
                <Plus className="h-4 w-4" />
                Создать инструкцию
              </Link>
            }
          />
        ) : (
          <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <InstructionTree
              folders={folders || []}
              instructions={instructions}
              selectedFolderId={selectedFolderId}
              onSelectFolder={setSelectedFolderId}
            />

            <div className="space-y-4">
              {visibleInstructions.length === 0 ? (
                <div className="section-surface">
                  <div className="card-body text-sm text-slate-500">
                    В выбранной ветке сейчас нет инструкций.
                  </div>
                </div>
              ) : (
                visibleInstructions.map((instruction) => (
                  <div key={instruction.id} className="section-surface">
                    <div className="card-body">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="page-chip font-mono">{instruction.publicId}</span>
                            <InstructionStatusBadge status={instruction.status} />
                            {instruction.folder && <span className="page-chip">{instruction.folder.name}</span>}
                            <span className="text-xs text-slate-400">{formatRelative(instruction.updatedAt)}</span>
                          </div>

                          <h2 className="mt-4 text-xl font-semibold text-slate-900">
                            <Link href={`/instructions/${instruction.publicId}`} className="hover:text-primary">
                              {instruction.title}
                            </Link>
                          </h2>

                          {instruction.summary && (
                            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">{instruction.summary}</p>
                          )}

                          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                            <span>Автор: {instruction.createdBy.fullName}</span>
                            <span>Вложений: {instruction._count?.attachments ?? instruction.attachments.length}</span>
                            <span>Карточек: {instruction._count?.cardLinks ?? instruction.cardLinks.length}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/instructions/${instruction.publicId}`} className="btn-secondary">
                            Открыть
                          </Link>
                          <Link href={`/instructions/${instruction.publicId}`} target="_blank" className="btn-secondary">
                            <ExternalLink className="h-4 w-4" />
                            В новой вкладке
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
