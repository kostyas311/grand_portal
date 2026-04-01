'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Search, Download, CheckCircle, Filter, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { cardsApi, dataSourcesApi, resultsApi, sprintsApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { EmptyState } from '@/components/shared/EmptyState';
import { useAuthStore } from '@/lib/store/auth.store';

export default function PortalHomePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [filters, setFilters] = useState({
    search: '',
    dataSourceId: '',
    sprintId: '',
    page: 1,
    sortOrder: 'desc' as 'asc' | 'desc',
  });

  const { data: sprints = [] } = useQuery({
    queryKey: ['sprints'],
    queryFn: () => sprintsApi.getAll(),
  });
  const currentSprint = sprints.find((sprint) => sprint.status === 'IN_PROGRESS') ?? null;
  const defaultSprintId = currentSprint?.id || sprints[0]?.id || '';

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      router.replace('/cards');
    }
  }, [user?.role, router]);

  useEffect(() => {
    if (!filters.sprintId && defaultSprintId) {
      setFilters((prev) => ({ ...prev, sprintId: defaultSprintId }));
    }
  }, [defaultSprintId, filters.sprintId]);

  const { data: cards, isLoading } = useQuery({
    queryKey: ['done-cards', filters],
    queryFn: () => cardsApi.getDone({
      search: filters.search || undefined,
      dataSourceId: filters.dataSourceId || undefined,
      sprintId: filters.sprintId || undefined,
      page: filters.page,
      limit: 20,
      sortOrder: filters.sortOrder,
    }),
    enabled: !!filters.sprintId,
  });

  const { data: sources } = useQuery({
    queryKey: ['data-sources-active'],
    queryFn: () => dataSourcesApi.getAll(),
  });

  const updateFilter = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const extractFileName = (contentDisposition?: string, fallback = 'download') => {
    if (!contentDisposition) {
      return fallback;
    }

    const utf8Match = contentDisposition.match(/filename\*\=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      return decodeURIComponent(utf8Match[1]);
    }

    const plainMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
    if (plainMatch?.[1]) {
      return plainMatch[1];
    }

    return fallback;
  };

  const saveBlob = (blob: Blob, fileName: string) => {
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(objectUrl);
  };

  const handleDownloadResultZip = async (cardId: string, versionId: string) => {
    try {
      const { blob, contentDisposition } = await resultsApi.downloadVersionAll(cardId, versionId);
      saveBlob(blob, extractFileName(contentDisposition, `${cardId}-results.zip`));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Не удалось скачать архив результата');
    }
  };

  if (user?.role === 'ADMIN') {
    return null;
  }

  return (
    <AppLayout>
      <div className="page-container">
        <div className="page-hero">
          <div className="page-hero-body">
            <div className="page-title-row">
              <div className="flex-1 min-w-0">
                <div className="page-kicker">Витрина результатов</div>
                <h1 className="mt-4 text-2xl font-semibold text-slate-900">Готовые проекты</h1>
                <p className="page-subtitle">
                  Все завершённые карточки с итоговыми файлами и внешними ссылками, доступными для скачивания.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card mb-4">
          <div className="card-body">
            <div className="filter-bar">
              {/* Search */}
              <div className="relative flex-1 min-w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Поиск по проектам..."
                  className="input pl-9"
                  value={filters.search}
                  onChange={e => updateFilter('search', e.target.value)}
                />
              </div>

              {/* Source filter */}
              <select
                className="input w-auto"
                value={filters.dataSourceId}
                onChange={e => updateFilter('dataSourceId', e.target.value)}
              >
                <option value="">Все источники</option>
                {sources?.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              {/* Month */}
              <select
                className="input w-auto"
                value={filters.sprintId}
                onChange={e => updateFilter('sprintId', e.target.value)}
              >
                <option value="">Все спринты</option>
                {sprints.map((sprint) => (
                  <option key={sprint.id} value={sprint.id}>
                    {sprint.name}
                  </option>
                ))}
              </select>

              {/* Sort */}
              <select
                className="input w-auto"
                value={filters.sortOrder}
                onChange={e => updateFilter('sortOrder', e.target.value)}
              >
                <option value="desc">Новые сначала</option>
                <option value="asc">Старые сначала</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="card">
            <div className="card-body space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton h-20" />
              ))}
            </div>
          </div>
        ) : !cards?.items?.length ? (
          <div className="card">
            <EmptyState
              icon={CheckCircle}
              title="Нет готовых проектов"
              description={filters.search || filters.dataSourceId
                ? 'По выбранным фильтрам проектов не найдено'
                : 'Завершённые карточки будут появляться здесь'}
            />
          </div>
        ) : (
          <>
            <div className="text-sm text-gray-500 mb-3">
              Найдено проектов: <span className="font-medium text-gray-700">{cards.total}</span>
            </div>
            <div className="space-y-3">
              {cards.items.map((card: any) => {
                const currentVersion = card.resultVersions?.[0];

                return (
                  <div key={card.id} className="card hover:shadow-card-hover transition-shadow">
                    <div className="card-body">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-xs text-gray-400">{card.publicId}</span>
                              <span className="text-gray-300">·</span>
                              <span className="text-sm text-gray-500">
                              {card.sprint?.name || '—'}
                              </span>
                            {card.completedAt && (
                              <>
                                <span className="text-gray-300">·</span>
                                <span className="text-xs text-green-600">
                                  Завершено {formatDate(card.completedAt)}
                                </span>
                              </>
                            )}
                          </div>

                          <Link
                            href={`/cards/${card.publicId}`}
                            className="text-base font-semibold text-gray-800 hover:text-primary hover:underline"
                          >
                            {card.dataSource?.name}
                            {card.extraTitle && (
                              <span className="text-gray-500 font-normal"> — {card.extraTitle}</span>
                            )}
                          </Link>

                          {card.description && (
                            <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                              {card.description}
                            </p>
                          )}

                          {/* Result items preview */}
                          {currentVersion?.items?.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2 min-w-0">
                              {currentVersion.items.slice(0, 3).map((item: any) => (
                                <div
                                  key={item.id}
                                  className="flex items-center gap-1 text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 text-gray-600 max-w-xs"
                                >
                                  {item.itemType === 'FILE'
                                    ? <Download className="w-3 h-3 flex-shrink-0" />
                                    : <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                  }
                                  <span className="truncate">{item.title}</span>
                                </div>
                              ))}
                              {currentVersion.items.length > 3 && (
                                <span className="text-xs text-gray-400">
                                  +{currentVersion.items.length - 3} ещё
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          {currentVersion?.items?.some((i: any) => i.itemType === 'FILE') && (
                            <button
                              type="button"
                              onClick={() => handleDownloadResultZip(card.id, currentVersion.id)}
                              className="btn-primary text-xs px-4 py-1.5"
                            >
                              <Download className="w-3 h-3" />
                              Скачать файлы
                            </button>
                          )}
                          <Link
                            href={`/cards/${card.publicId}`}
                            className="btn-secondary text-xs px-4 py-1.5 text-center"
                          >
                            Открыть карточку
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {cards.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-gray-500">
                  Страница {cards.page} из {cards.totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    className="btn-secondary text-xs px-4 py-1.5"
                    disabled={cards.page === 1}
                    onClick={() => updateFilter('page', filters.page - 1)}
                  >
                    ← Назад
                  </button>
                  <button
                    className="btn-secondary text-xs px-4 py-1.5"
                    disabled={cards.page === cards.totalPages}
                    onClick={() => updateFilter('page', filters.page + 1)}
                  >
                    Вперёд →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
