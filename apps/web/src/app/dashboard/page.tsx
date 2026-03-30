'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, LayoutList, LayoutGrid } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { CardStatusBadge } from '@/components/cards/CardStatusBadge';
import { CardPriorityBadge } from '@/components/cards/CardPriorityBadge';
import { KanbanBoard } from '@/components/cards/KanbanBoard';
import { EmptyState } from '@/components/shared/EmptyState';
import { cardsApi } from '@/lib/api';
import { formatDate, getMonthName, getDueDateIndicator } from '@/lib/utils';
import { FileText } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';

type ViewMode = 'kanban' | 'list';
type Tab = 'assigned' | 'created';

const STATUS_OPTIONS = [
  { value: '', label: 'Все статусы' },
  { value: 'NEW', label: 'Новое' },
  { value: 'IN_PROGRESS', label: 'В работе' },
  { value: 'REVIEW', label: 'На проверке' },
  { value: 'DONE', label: 'Готово' },
  { value: 'CANCELLED', label: 'Отменено' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'Все приоритеты' },
  { value: 'OPTIONAL', label: 'Желательно' },
  { value: 'NORMAL', label: 'В рабочем режиме' },
  { value: 'URGENT', label: 'Срочно' },
  { value: 'CRITICAL', label: 'Очень срочно' },
];

export default function DashboardPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const currentDate = new Date();

  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [tab, setTab] = useState<Tab>('assigned');

  const [filters, setFilters] = useState({
    search: '',
    status: '',
    priority: '',
    page: 1,
  });

  const updateFilter = (key: string, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  // For kanban: карточки в зависимости от выбранного таба
  const kanbanQuery = useQuery({
    queryKey: ['dashboard-kanban', tab, user?.id ?? ''],
    queryFn: () =>
      cardsApi.getAll({
        assignedToMe: tab === 'assigned' ? true : undefined,
        createdByMe: tab === 'created' ? true : undefined,
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
        page: filters.page,
        limit: 20,
      }),
    enabled: viewMode === 'list',
  });

  const listData = listQuery.data;

  return (
    <AppLayout>
      {/* Header + табы — ограниченная ширина */}
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1 className="section-title">Мой кабинет</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Здравствуйте, {user?.fullName?.split(' ')[1] ?? user?.fullName}
            </p>
          </div>
          <Link href="/cards/new" className="btn-primary">
            <Plus className="w-4 h-4" />
            Создать карточку
          </Link>
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
      </div>

      {/* Kanban view — полная ширина */}
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
              queryKey={['dashboard-kanban', user?.id ?? '']}
            />
          )}
        </div>
      )}

      {/* List view */}
      {viewMode === 'list' && (
        <div className="page-container">
          {/* List filters */}
          <div className="card mb-4">
            <div className="card-body">
              <div className="filter-bar">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Поиск по карточкам..."
                    className="input pl-9"
                    value={filters.search}
                    onChange={(e) => updateFilter('search', e.target.value)}
                  />
                </div>
                <select
                  className="input w-auto"
                  value={filters.status}
                  onChange={(e) => updateFilter('status', e.target.value)}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <select
                  className="input w-auto"
                  value={filters.priority}
                  onChange={(e) => updateFilter('priority', e.target.value)}
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="card">
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
                    {listData.items.map((card: any) => {
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
