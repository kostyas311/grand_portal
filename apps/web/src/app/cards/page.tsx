'use client';

import { useState, Suspense, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, LayoutList, LayoutGrid } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { CardStatusBadge } from '@/components/cards/CardStatusBadge';
import { CardPriorityBadge } from '@/components/cards/CardPriorityBadge';
import { KanbanBoard } from '@/components/cards/KanbanBoard';
import { EmptyState } from '@/components/shared/EmptyState';
import { cardsApi, dataSourcesApi } from '@/lib/api';
import { formatDate, getMonthName, getDueDateIndicator } from '@/lib/utils';
import { FileText } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';

type ViewMode = 'kanban' | 'list';

function AllCardsContent() {
  const currentDate = new Date();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();

  // Redirect USER role to dashboard
  useEffect(() => {
    if (user?.role === 'USER') {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || '',
    dataSourceId: searchParams.get('dataSourceId') || '',
    month: searchParams.get('month') || '',
    year: searchParams.get('year') || '',
    priority: searchParams.get('priority') || '',
    isArchived: searchParams.get('status') === 'CANCELLED',
    page: 1,
  });

  const updateFilter = (key: string, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i);

  // Kanban: fetch all without pagination
  const kanbanQuery = useQuery({
    queryKey: ['all-cards-kanban'],
    queryFn: () => cardsApi.getAll({ limit: 200 }),
    enabled: viewMode === 'kanban',
  });

  // List: paginated with filters
  const listQuery = useQuery({
    queryKey: ['all-cards', filters],
    queryFn: () =>
      cardsApi.getAll({
        search: filters.search || undefined,
        status: filters.status || undefined,
        dataSourceId: filters.dataSourceId || undefined,
        month: filters.month ? Number(filters.month) : undefined,
        year: filters.year ? Number(filters.year) : undefined,
        priority: filters.priority || undefined,
        isArchived: filters.isArchived,
        page: filters.page,
        limit: 20,
      }),
    enabled: viewMode === 'list',
  });

  const { data: sources } = useQuery({
    queryKey: ['data-sources-filter'],
    queryFn: () => dataSourcesApi.getAll(),
  });

  const data = listQuery.data;

  if (user?.role === 'USER') return null;

  return (
    <AppLayout>
      {/* Header — ограниченная ширина */}
      <div className="page-container">
        <div className="page-header">
          <h1 className="section-title">Все карточки</h1>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'kanban' ? 'bg-white shadow text-primary' : 'text-gray-400 hover:text-gray-600'}`}
                onClick={() => setViewMode('kanban')}
                title="Канбан"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow text-primary' : 'text-gray-400 hover:text-gray-600'}`}
                onClick={() => setViewMode('list')}
                title="Список"
              >
                <LayoutList className="w-4 h-4" />
              </button>
            </div>
            <Link href="/cards/new" className="btn-primary">
              <Plus className="w-4 h-4" />
              Создать карточку
            </Link>
          </div>
        </div>
      </div>

      {/* Kanban view — полная ширина без ограничения max-w */}
      {viewMode === 'kanban' && (
        <div className="px-6 pb-6">
          {kanbanQuery.isLoading ? (
            <div className="flex gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex-1 min-w-[180px] h-64 skeleton rounded-lg" />
              ))}
            </div>
          ) : (
            <KanbanBoard
              cards={kanbanQuery.data?.items || []}
              queryKey={['all-cards-kanban']}
            />
          )}
        </div>
      )}

      {/* List view */}
      {viewMode === 'list' && (
        <div className="page-container">
          <>
            {/* Filters */}
            <div className="card mb-4">
              <div className="card-body">
                <div className="filter-bar">
                  <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Поиск..."
                      className="input pl-9"
                      value={filters.search}
                      onChange={(e) => updateFilter('search', e.target.value)}
                    />
                  </div>
                  <select className="input w-auto" value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
                    <option value="">Все статусы</option>
                    {['NEW', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED'].map((s) => (
                      <option key={s} value={s}>
                        {{ NEW: 'Новое', IN_PROGRESS: 'В работе', REVIEW: 'На проверке', DONE: 'Готово', CANCELLED: 'Отменено' }[s]}
                      </option>
                    ))}
                  </select>
                  <select className="input w-auto" value={filters.dataSourceId} onChange={(e) => updateFilter('dataSourceId', e.target.value)}>
                    <option value="">Все источники</option>
                    {sources?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <select className="input w-auto" value={filters.month} onChange={(e) => updateFilter('month', e.target.value)}>
                    <option value="">Все месяцы</option>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>{getMonthName(i + 1)}</option>
                    ))}
                  </select>
                  <select className="input w-auto" value={filters.year} onChange={(e) => updateFilter('year', e.target.value)}>
                    <option value="">Все годы</option>
                    {years.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <select className="input w-auto" value={filters.priority} onChange={(e) => updateFilter('priority', e.target.value)}>
                    <option value="">Все приоритеты</option>
                    <option value="OPTIONAL">Желательно</option>
                    <option value="NORMAL">В рабочем режиме</option>
                    <option value="URGENT">Срочно</option>
                    <option value="CRITICAL">Очень срочно</option>
                  </select>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={filters.isArchived}
                      onChange={(e) => updateFilter('isArchived', e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    Показать архив
                  </label>
                </div>
              </div>
            </div>

            <div className="card">
              {listQuery.isLoading ? (
                <div className="card-body space-y-2">
                  {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-10" />)}
                </div>
              ) : !data?.items?.length ? (
                <EmptyState
                  icon={FileText}
                  title="Карточки не найдены"
                  description="Попробуйте изменить фильтры или создайте первую карточку"
                  action={<Link href="/cards/new" className="btn-primary"><Plus className="w-4 h-4" />Создать карточку</Link>}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Источник / Название</th>
                        <th>Период</th>
                        <th>Статус</th>
                        <th>Приоритет</th>
                        <th>Срок</th>
                        <th>Исполнитель</th>
                        <th>Проверяющий</th>
                        <th>Обновлено</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((card: any) => {
                        const indicator = getDueDateIndicator(card.dueDate, card.status);
                        const rowBorder =
                          indicator === 'red' ? 'border-l-4 border-l-red-400' :
                          indicator === 'orange' ? 'border-l-4 border-l-orange-400' :
                          indicator === 'green' ? 'border-l-4 border-l-green-400' : '';
                        return (
                          <tr
                            key={card.id}
                            className={`${rowBorder} cursor-pointer hover:bg-gray-50`}
                            onClick={() => router.push(`/cards/${card.publicId}`)}
                          >
                            <td>
                              <span className="font-mono text-xs text-primary">{card.publicId}</span>
                            </td>
                            <td>
                              <div>
                                <span className="font-medium text-gray-800">{card.dataSource?.name}</span>
                                {card.extraTitle && <div className="text-xs text-gray-400">{card.extraTitle}</div>}
                              </div>
                            </td>
                            <td className="text-sm text-gray-500">{getMonthName(card.month)} {card.year}</td>
                            <td><CardStatusBadge status={card.status} /></td>
                            <td><CardPriorityBadge priority={card.priority} /></td>
                            <td>
                              <div className="flex items-center gap-1.5">
                                {indicator && (
                                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                    indicator === 'red' ? 'bg-red-500' :
                                    indicator === 'orange' ? 'bg-orange-400' : 'bg-green-500'
                                  }`} />
                                )}
                                <span className={`text-sm ${indicator === 'red' ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                                  {card.dueDate ? formatDate(card.dueDate) : '—'}
                                </span>
                              </div>
                            </td>
                            <td className="text-sm text-gray-600">{card.executor?.fullName || '—'}</td>
                            <td className="text-sm text-gray-600">{card.reviewer?.fullName || '—'}</td>
                            <td className="text-xs text-gray-400">{formatDate(card.updatedAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {data && data.totalPages > 1 && (
                <div className="card-body border-t border-gray-100 flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    {data.total} карточек · Страница {data.page} из {data.totalPages}
                  </span>
                  <div className="flex gap-2">
                    <button className="btn-secondary text-xs px-3 py-1.5" disabled={data.page === 1}
                      onClick={() => updateFilter('page', filters.page - 1)}>← Назад</button>
                    <button className="btn-secondary text-xs px-3 py-1.5" disabled={data.page === data.totalPages}
                      onClick={() => updateFilter('page', filters.page + 1)}>Вперёд →</button>
                  </div>
                </div>
              )}
            </div>
          </>
        </div>
      )}
    </AppLayout>
  );
}

export default function AllCardsPage() {
  return (
    <Suspense fallback={null}>
      <AllCardsContent />
    </Suspense>
  );
}
