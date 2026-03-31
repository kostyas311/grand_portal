'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, LayoutList, LayoutGrid, ArrowUpDown, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { CardStatusBadge } from '@/components/cards/CardStatusBadge';
import { CardPriorityBadge } from '@/components/cards/CardPriorityBadge';
import { KanbanBoard } from '@/components/cards/KanbanBoard';
import { CardFiltersPanel } from '@/components/cards/CardFiltersPanel';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { EmptyState } from '@/components/shared/EmptyState';
import { cardsApi } from '@/lib/api';
import { formatDate, getMonthName, getDueDateIndicator } from '@/lib/utils';
import { FileText } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';

type ViewMode = 'kanban' | 'list';
type Tab = 'assigned' | 'created';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const currentDate = new Date();
  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i);
  const defaultMonth = String(currentDate.getMonth() + 1);
  const defaultYear = String(currentDate.getFullYear());

  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [tab, setTab] = useState<Tab>('assigned');

  const [filters, setFilters] = useState({
    search: '',
    status: '',
    priority: '',
    month: String(currentDate.getMonth() + 1),
    year: String(currentDate.getFullYear()),
    sortBy: 'updatedAt',
    sortOrder: 'desc' as 'asc' | 'desc',
    page: 1,
  });

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

  // For kanban: карточки в зависимости от выбранного таба
  const kanbanQuery = useQuery({
    queryKey: ['dashboard-kanban', tab, filters, user?.id ?? ''],
    queryFn: () =>
      cardsApi.getAll({
        assignedToMe: tab === 'assigned' ? true : undefined,
        createdByMe: tab === 'created' ? true : undefined,
        status: filters.status || undefined,
        priority: filters.priority || undefined,
        search: filters.search || undefined,
        month: filters.month ? Number(filters.month) : undefined,
        year: filters.year ? Number(filters.year) : undefined,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        limit: 200,
      }),
    enabled: viewMode === 'kanban',
  });

  // For list: paginated with filters
  const listQuery = useQuery({
    queryKey: ['dashboard-list', tab, filters, user?.id ?? ''],
    queryFn: () =>
      cardsApi.getAll({
        assignedToMe: tab === 'assigned' ? true : undefined,
        createdByMe: tab === 'created' ? true : undefined,
        status: filters.status || undefined,
        priority: filters.priority || undefined,
        search: filters.search || undefined,
        month: filters.month ? Number(filters.month) : undefined,
        year: filters.year ? Number(filters.year) : undefined,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        page: filters.page,
        limit: 20,
      }),
    enabled: viewMode === 'list',
  });

  const listData = listQuery.data;

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

  const resetFilters = () => {
    setFilters((prev) => ({
      ...prev,
      search: '',
      status: '',
      priority: '',
      month: defaultMonth,
      year: defaultYear,
      page: 1,
    }));
  };

  return (
    <AppLayout>
      {/* Header + табы — ограниченная ширина */}
      <div className="page-container-wide">
        <div className="page-header">
          <div>
            <h1 className="section-title">Мой кабинет</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Здравствуйте, {user?.fullName?.split(' ')[1] ?? user?.fullName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <Link href="/cards/new" className="btn-primary">
              <Plus className="w-4 h-4" />
              Создать карточку
            </Link>
          </div>
        </div>

        {/* Tabs + View toggle */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === 'assigned' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setTab('assigned')}
            >
              Назначено на меня
            </button>
            <button
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === 'created' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setTab('created')}
            >
              Создано мной
            </button>
          </div>

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
        </div>

        <CardFiltersPanel
          filters={filters}
          years={years}
          defaultMonth={defaultMonth}
          defaultYear={defaultYear}
          searchPlaceholder="Поиск по моим карточкам..."
          onChange={updateFilter}
          onReset={resetFilters}
        />
      </div>

      {/* Kanban view — полная ширина */}
      {viewMode === 'kanban' && (
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
              queryKey={['dashboard-kanban', tab, filters, user?.id ?? '']}
            />
          )}
        </div>
      )}

      {/* List view */}
      {viewMode === 'list' && (
        <div className="page-container-wide">
          <div className="list-surface">
            <div className="list-surface-header">
              <div>
                <h2 className="list-surface-title">
                  {tab === 'assigned' ? 'Карточки, назначенные на меня' : 'Карточки, созданные мной'}
                </h2>
                <p className="list-surface-subtitle">
                  {listData?.total ?? 0} карточек в текущей выборке
                </p>
              </div>
            </div>
            {listQuery.isLoading ? (
              <div className="card-body">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="skeleton h-12 mb-2" />
                ))}
              </div>
            ) : !listData?.items?.length ? (
              <EmptyState
                icon={FileText}
                title="Карточки не найдены"
                description={
                  tab === 'assigned'
                    ? 'Вам пока не назначены карточки'
                    : 'Вы ещё не создали ни одной карточки'
                }
                action={
                  <Link href="/cards/new" className="btn-primary">
                    <Plus className="w-4 h-4" />
                    Создать карточку
                  </Link>
                }
              />
            ) : (
              <div className="table-shell">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{renderSortHeader('ID', 'publicId')}</th>
                      <th>{renderSortHeader('Источник / Название', 'dataSource')}</th>
                      <th>{renderSortHeader('Период', 'year')}</th>
                      <th>{renderSortHeader('Статус', 'status')}</th>
                      <th>{renderSortHeader('Приоритет', 'priority')}</th>
                      <th>{renderSortHeader('Срок', 'dueDate')}</th>
                      <th>{renderSortHeader('Исполнитель', 'executor')}</th>
                      <th>{renderSortHeader('Проверяющий', 'reviewer')}</th>
                      <th>{renderSortHeader('Обновлено', 'updatedAt')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listData.items.map((card: any) => {
                      const indicator = getDueDateIndicator(card.dueDate, card.status);
                      const hasNoSourceMaterials = !!card.withoutSourceMaterials && (card._count?.sourceMaterials ?? 0) === 0;
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
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-gray-800">{card.dataSource?.name}</span>
                                {hasNoSourceMaterials && (
                                  <span className="attention-chip">
                                    <AlertTriangle className="w-3 h-3" />
                                    Информационная
                                  </span>
                                )}
                              </div>
                              {card.extraTitle && (
                                <div className="text-xs text-gray-400">{card.extraTitle}</div>
                              )}
                            </div>
                          </td>
                          <td className="text-sm text-gray-500">
                            {getMonthName(card.month)} {card.year}
                          </td>
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

            {listData && listData.totalPages > 1 && (
              <div className="card-body border-t border-gray-100 flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  {listData.total} карточек · Страница {listData.page} из {listData.totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    className="btn-secondary text-xs px-3 py-1.5"
                    disabled={listData.page === 1}
                    onClick={() => updateFilter('page', filters.page - 1)}
                  >
                    ← Назад
                  </button>
                  <button
                    className="btn-secondary text-xs px-3 py-1.5"
                    disabled={listData.page === listData.totalPages}
                    onClick={() => updateFilter('page', filters.page + 1)}
                  >
                    Вперёд →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
