'use client';

import { useState, Suspense, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ReadonlyURLSearchParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, LayoutList, LayoutGrid, ArrowUpDown, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { CardStatusBadge } from '@/components/cards/CardStatusBadge';
import { CardPriorityBadge } from '@/components/cards/CardPriorityBadge';
import { KanbanBoard } from '@/components/cards/KanbanBoard';
import { CardFiltersPanel } from '@/components/cards/CardFiltersPanel';
import { EmptyState } from '@/components/shared/EmptyState';
import { cardsApi, dataSourcesApi, sprintsApi } from '@/lib/api';
import { formatDate, getDueDateIndicator } from '@/lib/utils';
import { FileText } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';

type ViewMode = 'kanban' | 'list';

type CardFiltersState = {
  search: string;
  status: string;
  dataSourceId: string;
  sprintId: string;
  dueDateFrom: string;
  dueDateTo: string;
  priority: string;
  isArchived?: boolean;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  page: number;
};

function getViewModeFromSearchParams(searchParams: ReadonlyURLSearchParams): ViewMode {
  return searchParams.get('view') === 'list' ||
    !!searchParams.get('status') ||
    !!searchParams.get('sprintId') ||
    !!searchParams.get('dueDateFrom') ||
    !!searchParams.get('dueDateTo')
      ? 'list'
      : 'kanban';
}

function getFiltersFromSearchParams(
  searchParams: ReadonlyURLSearchParams,
  defaultSprintId: string,
): CardFiltersState {
  const isArchivedParam = searchParams.get('isArchived');

  return {
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || '',
    dataSourceId: searchParams.get('dataSourceId') || '',
    sprintId: searchParams.get('sprintId') || defaultSprintId,
    dueDateFrom: searchParams.get('dueDateFrom') || '',
    dueDateTo: searchParams.get('dueDateTo') || '',
    priority: searchParams.get('priority') || '',
    isArchived: isArchivedParam === 'true'
      ? true
      : isArchivedParam === 'false'
      ? false
      : searchParams.get('status') === 'CANCELLED'
      ? true
      : undefined,
    sortBy: searchParams.get('sortBy') || 'updatedAt',
    sortOrder: searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc',
    page: 1,
  };
}

function AllCardsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const searchParamsKey = searchParams.toString();

  const { data: sprints = [] } = useQuery({
    queryKey: ['sprints'],
    queryFn: () => sprintsApi.getAll(),
  });
  const currentSprint = sprints.find((sprint) => sprint.status === 'IN_PROGRESS') ?? null;
  const defaultSprintId = currentSprint?.id || sprints[0]?.id || '';

  // Redirect USER role to dashboard
  useEffect(() => {
    if (user?.role === 'USER') {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const [viewMode, setViewMode] = useState<ViewMode>(() => getViewModeFromSearchParams(searchParams));
  const [filters, setFilters] = useState<CardFiltersState>(() => getFiltersFromSearchParams(searchParams, defaultSprintId));
  const selectedSprint = sprints.find((sprint) => sprint.id === filters.sprintId) ?? currentSprint ?? sprints[0] ?? null;

  useEffect(() => {
    setViewMode(getViewModeFromSearchParams(searchParams));
    setFilters(getFiltersFromSearchParams(searchParams, defaultSprintId));
  }, [searchParams, searchParamsKey, defaultSprintId]);

  const updateFilter = (key: string, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const toggleSort = (sortBy: string) => {
    setFilters((prev) => ({
      ...prev,
      sortBy,
      sortOrder: prev.sortBy === sortBy && prev.sortOrder === 'asc' ? 'desc' : 'asc',
      page: 1,
    }));
  };

  // Kanban: fetch all without pagination
  const kanbanQuery = useQuery({
    queryKey: ['all-cards-kanban', filters],
    queryFn: () => cardsApi.getAll({
      search: filters.search || undefined,
      status: filters.status || undefined,
      dataSourceId: filters.dataSourceId || undefined,
      sprintId: filters.sprintId || undefined,
      dueDateFrom: filters.dueDateFrom || undefined,
      dueDateTo: filters.dueDateTo || undefined,
      priority: filters.priority || undefined,
      isArchived: filters.isArchived,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
      limit: 200,
    }),
    enabled: viewMode === 'kanban' && !!filters.sprintId,
  });

  // List: paginated with filters
  const listQuery = useQuery({
    queryKey: ['all-cards', filters],
    queryFn: () =>
      cardsApi.getAll({
        search: filters.search || undefined,
        status: filters.status || undefined,
        dataSourceId: filters.dataSourceId || undefined,
        sprintId: filters.sprintId || undefined,
        dueDateFrom: filters.dueDateFrom || undefined,
        dueDateTo: filters.dueDateTo || undefined,
        priority: filters.priority || undefined,
        isArchived: filters.isArchived,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        page: filters.page,
        limit: 20,
      }),
    enabled: viewMode === 'list' && !!filters.sprintId,
  });

  const { data: sources } = useQuery({
    queryKey: ['data-sources-filter'],
    queryFn: () => dataSourcesApi.getAll(),
  });

  const data = listQuery.data;

  const renderSortHeader = (label: string, sortBy: string) => {
    const isActive = filters.sortBy === sortBy;
    return (
      <button
        type="button"
        className={`inline-flex items-center gap-1 transition-colors ${isActive ? 'text-primary' : 'text-gray-500 hover:text-gray-700'}`}
        onClick={() => toggleSort(sortBy)}
      >
        <span>{label}</span>
        {isActive ? (
          filters.sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 opacity-60" />
        )}
      </button>
    );
  };

  if (user?.role === 'USER') return null;

  const resetFilters = () => {
    setFilters((prev) => ({
      ...prev,
      search: '',
      status: '',
      dataSourceId: '',
      sprintId: defaultSprintId,
      dueDateFrom: '',
      dueDateTo: '',
      priority: '',
      isArchived: undefined,
      page: 1,
    }));
  };

  return (
    <AppLayout>
      <div className="page-container-wide pb-3">
        <div className="page-hero">
          <div className="page-hero-body">
            <div className="page-title-row">
              <div className="flex-1 min-w-0">
                <div className="page-kicker">Карточки</div>
                <h1 className="mt-4 text-2xl font-semibold text-slate-900">Все карточки</h1>
                <p className="page-subtitle">
                  Общая рабочая база карточек с фильтрацией, сортировкой и быстрым переключением между списком и канбаном в рамках выбранного спринта.
                </p>
              </div>

              <div className="card-action-toolbar">
                <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
                  <button
                    className={`p-1.5 rounded-lg transition-colors ${viewMode === 'kanban' ? 'bg-white shadow-sm text-primary' : 'text-slate-400 hover:text-slate-600'}`}
                    onClick={() => setViewMode('kanban')}
                    title="Канбан"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-primary' : 'text-slate-400 hover:text-slate-600'}`}
                    onClick={() => setViewMode('list')}
                    title="Список"
                  >
                    <LayoutList className="w-4 h-4" />
                  </button>
                </div>
                <Link href="/cards/new" className="toolbar-button toolbar-button-primary">
                  <Plus className="w-4 h-4" />
                  Создать карточку
                </Link>
              </div>
            </div>

            <div className="mt-5">
              <CardFiltersPanel
                filters={filters}
                sprints={sprints}
                defaultSprintId={defaultSprintId}
                sources={sources}
                showDataSource
                showDueDateRange
                showArchive
                searchPlaceholder="Поиск по карточкам..."
                defaultCollapsed
                autoExpandOnActive={false}
                onChange={updateFilter}
                onReset={resetFilters}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Kanban view — полная ширина без ограничения max-w */}
      {viewMode === 'kanban' && !!filters.sprintId && (
        <div className="page-container-wide pt-0">
          {kanbanQuery.isLoading ? (
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="w-[300px] h-[420px] skeleton rounded-xl" />
              ))}
            </div>
          ) : (
            <KanbanBoard
              cards={kanbanQuery.data?.items || []}
              queryKey={['all-cards-kanban', filters]}
            />
          )}
        </div>
      )}

      {/* List view */}
      {viewMode === 'list' && !!filters.sprintId && (
        <div className="page-container-wide pt-0">
          <>
            <div className="list-surface">
              <div className="list-surface-header">
                <div>
                  <h2 className="list-surface-title">Результаты фильтрации карточек</h2>
                  <p className="list-surface-subtitle">
                    {data?.total ?? 0} карточек в текущей выборке
                  </p>
                </div>
              </div>
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
                <div className="table-shell">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{renderSortHeader('ID', 'publicId')}</th>
                        <th>{renderSortHeader('Источник / Название', 'dataSource')}</th>
                        <th>{renderSortHeader('Спринт', 'sprint')}</th>
                        <th>{renderSortHeader('Статус', 'status')}</th>
                        <th>{renderSortHeader('Приоритет', 'priority')}</th>
                        <th>{renderSortHeader('Срок', 'dueDate')}</th>
                        <th>{renderSortHeader('Исполнитель', 'executor')}</th>
                        <th>{renderSortHeader('Проверяющий', 'reviewer')}</th>
                        <th>{renderSortHeader('Обновлено', 'updatedAt')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((card: any) => {
                        const indicator = getDueDateIndicator(card.dueDate, card.status);
                        const hasNoSourceMaterials = !!card.withoutSourceMaterials && (card._count?.sourceMaterials ?? 0) === 0;
                        const hasChildren = (card.children?.length ?? 0) > 0;
                        const rowBorder =
                          indicator === 'red' ? 'border-l-4 border-l-red-400' :
                          indicator === 'orange' ? 'border-l-4 border-l-orange-400' :
                          indicator === 'green' ? 'border-l-4 border-l-green-400' : '';
                        return (
                          <tr
                            key={card.id}
                            className={`${rowBorder} ${hasChildren ? 'table-row-parent' : ''} cursor-pointer hover:bg-gray-50`}
                            onClick={() => router.push(`/cards/${card.publicId}`)}
                          >
                            <td>
                              <span className="font-mono text-xs text-primary">{card.publicId}</span>
                            </td>
                            <td>
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={hasChildren ? 'font-medium table-parent-title' : 'font-medium text-gray-800'}>
                                    {card.dataSource?.name}
                                  </span>
                                  {hasNoSourceMaterials && (
                                    <span className="attention-chip">
                                      <AlertTriangle className="w-3 h-3" />
                                      Информационная
                                    </span>
                                  )}
                                </div>
                                {card.extraTitle && <div className="text-xs text-gray-400">{card.extraTitle}</div>}
                              </div>
                            </td>
                            <td className="text-sm text-gray-500">{card.sprint?.name || '—'}</td>
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
