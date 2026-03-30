'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Search, Download, CheckCircle, Filter, ExternalLink } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { cardsApi, dataSourcesApi, resultsApi } from '@/lib/api';
import { formatDate, getMonthName } from '@/lib/utils';
import { EmptyState } from '@/components/shared/EmptyState';

export default function PortalHomePage() {
  const currentDate = new Date();
  const [filters, setFilters] = useState({
    search: '',
    dataSourceId: '',
    month: String(currentDate.getMonth() + 1),
    year: String(currentDate.getFullYear()),
    page: 1,
    sortOrder: 'desc' as 'asc' | 'desc',
  });

  const { data: cards, isLoading } = useQuery({
    queryKey: ['done-cards', filters],
    queryFn: () => cardsApi.getDone({
      search: filters.search || undefined,
      dataSourceId: filters.dataSourceId || undefined,
      month: filters.month ? Number(filters.month) : undefined,
      year: filters.year ? Number(filters.year) : undefined,
      page: filters.page,
      limit: 20,
      sortOrder: filters.sortOrder,
    }),
  });

  const { data: sources } = useQuery({
    queryKey: ['data-sources-active'],
    queryFn: () => dataSourcesApi.getAll(),
  });

  const updateFilter = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const years = Array.from({ length: 5 }, (_, i) => {
    const y = currentDate.getFullYear() - 2 + i;
    return { value: String(y), label: String(y) };
  });

  return (
    <AppLayout>
      <div className="page-container">
        {/* Header */}
        <div className="page-header">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-6 h-6 text-green-500" />
              <h1 className="section-title">Готовые проекты</h1>
            </div>
            <p className="text-sm text-gray-500">
              Все завершённые карточки. Результаты доступны для скачивания.
            </p>
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
                value={filters.month}
                onChange={e => updateFilter('month', e.target.value)}
              >
                <option value="">Все месяцы</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={String(i + 1)}>
                    {getMonthName(i + 1)}
                  </option>
                ))}
              </select>

              {/* Year */}
              <select
                className="input w-auto"
                value={filters.year}
                onChange={e => updateFilter('year', e.target.value)}
              >
                <option value="">Все годы</option>
                {years.map(y => (
                  <option key={y.value} value={y.value}>{y.label}</option>
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
                              {getMonthName(card.month)} {card.year}
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
                            <a
                              href={resultsApi.downloadVersionAllUrl(card.id, currentVersion.id)}
                              className="btn-primary text-xs px-4 py-1.5"
                              download
                            >
                              <Download className="w-3 h-3" />
                              Скачать файлы
                            </a>
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
