'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AppLayout } from '@/components/layout/AppLayout';
import { cardsApi, sprintsApi } from '@/lib/api';

const STATUSES = [
  { value: 'NEW', label: 'Новое', color: '#6b7280' },
  { value: 'IN_PROGRESS', label: 'В работе', color: '#3b82f6' },
  { value: 'REVIEW', label: 'На проверке', color: '#f59e0b' },
  { value: 'DONE', label: 'Готово', color: '#10b981' },
  { value: 'CANCELLED', label: 'Отменено', color: '#ef4444' },
];

export default function ReportsPage() {
  const [filters, setFilters] = useState({
    sprintId: '',
    dueDateFrom: '',
    dueDateTo: '',
  });

  const { data: sprints = [] } = useQuery({
    queryKey: ['sprints'],
    queryFn: () => sprintsApi.getAll(),
  });

  const currentSprint = sprints.find((sprint) => sprint.status === 'IN_PROGRESS') ?? null;
  const defaultSprintId = currentSprint?.id || sprints[0]?.id || '';

  useEffect(() => {
    if (!filters.sprintId && defaultSprintId) {
      setFilters((prev) => ({ ...prev, sprintId: defaultSprintId }));
    }
  }, [defaultSprintId, filters.sprintId]);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['card-stats', filters],
    queryFn: () => cardsApi.getStats({
      sprintId: filters.sprintId || undefined,
      dueDateFrom: filters.dueDateFrom || undefined,
      dueDateTo: filters.dueDateTo || undefined,
    }),
    enabled: !!filters.sprintId,
  });

  const chartData = STATUSES.map(s => ({
    name: s.label,
    value: stats?.[s.value] ?? 0,
    color: s.color,
    status: s.value,
  }));

  const buildCardsLink = (status: string) => {
    const params = new URLSearchParams({ status, view: 'list' });
    if (filters.sprintId) params.set('sprintId', filters.sprintId);
    if (filters.dueDateFrom) params.set('dueDateFrom', filters.dueDateFrom);
    if (filters.dueDateTo) params.set('dueDateTo', filters.dueDateTo);
    if (status === 'CANCELLED') params.set('isArchived', 'true');
    return `/cards?${params.toString()}`;
  };

  return (
    <AppLayout>
      <div className="page-container max-w-4xl">
        <div className="page-hero">
          <div className="page-hero-body">
            <div className="page-title-row">
              <div className="flex-1 min-w-0">
                <div className="page-kicker">Аналитика</div>
                <h1 className="mt-4 text-2xl font-semibold text-slate-900">Отчёт по карточкам</h1>
                <p className="page-subtitle">
                  Сводная картина по статусам карточек с быстрым переходом в отфильтрованный список выбранного спринта.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card mb-4">
          <div className="card-body">
            <div className="filter-bar">
              <select
                className="input w-auto"
                value={filters.sprintId}
                onChange={e => setFilters(f => ({ ...f, sprintId: e.target.value }))}
              >
                <option value="">Все спринты</option>
                {sprints.map((sprint) => (
                  <option key={sprint.id} value={sprint.id}>{sprint.name}</option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 whitespace-nowrap">Срок от</span>
                <input
                  type="date"
                  className="input w-auto"
                  value={filters.dueDateFrom}
                  onChange={e => setFilters(f => ({ ...f, dueDateFrom: e.target.value }))}
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 whitespace-nowrap">до</span>
                <input
                  type="date"
                  className="input w-auto"
                  value={filters.dueDateTo}
                  onChange={e => setFilters(f => ({ ...f, dueDateTo: e.target.value }))}
                />
              </div>

              {(filters.sprintId !== defaultSprintId || filters.dueDateFrom || filters.dueDateTo) && (
                <button
                  className="btn-secondary text-sm"
                  onClick={() => setFilters({ sprintId: defaultSprintId, dueDateFrom: '', dueDateTo: '' })}
                >
                  Сбросить
                </button>
              )}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="card card-body">
            <div className="skeleton h-64" />
          </div>
        ) : (
          <>
            {/* Chart */}
            <div className="card mb-4">
              <div className="card-header">
                <h2 className="font-medium text-gray-700">Распределение по статусам</h2>
                <span className="text-sm text-gray-400">Всего: {stats?.total ?? 0}</span>
              </div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 13 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: number) => [value, 'Карточек']}
                      contentStyle={{ fontSize: 13 }}
                    />
                    <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Status counts table */}
            <div className="card">
              <div className="card-header">
                <h2 className="font-medium text-gray-700">Количество по статусам</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Статус</th>
                      <th>Количество</th>
                      <th>Доля</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {STATUSES.map(s => {
                      const count = stats?.[s.value] ?? 0;
                      const total = stats?.total ?? 0;
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                      return (
                        <tr key={s.value}>
                          <td>
                            <div className="flex items-center gap-2">
                              <span
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: s.color }}
                              />
                              <span className="text-sm text-gray-700">{s.label}</span>
                            </div>
                          </td>
                          <td>
                            {count > 0 ? (
                              <Link
                                href={buildCardsLink(s.value)}
                                className="font-semibold text-primary hover:underline"
                              >
                                {count}
                              </Link>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${pct}%`, backgroundColor: s.color }}
                                />
                              </div>
                              <span className="text-sm text-gray-500">{pct}%</span>
                            </div>
                          </td>
                          <td>
                            {count > 0 && (
                              <Link
                                href={buildCardsLink(s.value)}
                                className="text-xs text-primary hover:underline"
                              >
                                Открыть →
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="font-medium bg-gray-50">
                      <td className="text-gray-700">Итого</td>
                      <td className="text-gray-700">{stats?.total ?? 0}</td>
                      <td></td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
