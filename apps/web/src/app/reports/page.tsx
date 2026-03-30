'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AppLayout } from '@/components/layout/AppLayout';
import { cardsApi } from '@/lib/api';
import { getMonthName } from '@/lib/utils';

const STATUSES = [
  { value: 'NEW', label: 'Новое', color: '#6b7280' },
  { value: 'IN_PROGRESS', label: 'В работе', color: '#3b82f6' },
  { value: 'REVIEW', label: 'На проверке', color: '#f59e0b' },
  { value: 'DONE', label: 'Готово', color: '#10b981' },
  { value: 'CANCELLED', label: 'Отменено', color: '#ef4444' },
];

export default function ReportsPage() {
  const currentDate = new Date();
  const [filters, setFilters] = useState({
    month: '',
    year: String(currentDate.getFullYear()),
    dueDateFrom: '',
    dueDateTo: '',
  });

  const { data: stats, isLoading } = useQuery({
    queryKey: ['card-stats', filters],
    queryFn: () => cardsApi.getStats({
      month: filters.month ? Number(filters.month) : undefined,
      year: filters.year ? Number(filters.year) : undefined,
      dueDateFrom: filters.dueDateFrom || undefined,
      dueDateTo: filters.dueDateTo || undefined,
    }),
  });

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i);

  const chartData = STATUSES.map(s => ({
    name: s.label,
    value: stats?.[s.value] ?? 0,
    color: s.color,
    status: s.value,
  }));

  const buildCardsLink = (status: string) => {
    const params = new URLSearchParams({ status });
    if (filters.month) params.set('month', filters.month);
    if (filters.year) params.set('year', filters.year);
    if (filters.dueDateFrom) params.set('dueDateFrom', filters.dueDateFrom);
    if (filters.dueDateTo) params.set('dueDateTo', filters.dueDateTo);
    if (status === 'CANCELLED') params.set('isArchived', 'true');
    return `/cards?${params.toString()}`;
  };

  return (
    <AppLayout>
      <div className="page-container max-w-4xl">
        <div className="page-header">
          <h1 className="section-title">Отчёт по карточкам</h1>
        </div>

        {/* Filters */}
        <div className="card mb-4">
          <div className="card-body">
            <div className="filter-bar">
              <select
                className="input w-auto"
                value={filters.month}
                onChange={e => setFilters(f => ({ ...f, month: e.target.value }))}
              >
                <option value="">Все месяцы</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{getMonthName(i + 1)}</option>
                ))}
              </select>

              <select
                className="input w-auto"
                value={filters.year}
                onChange={e => setFilters(f => ({ ...f, year: e.target.value }))}
              >
                <option value="">Все годы</option>
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
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

              {(filters.month || filters.dueDateFrom || filters.dueDateTo) && (
                <button
                  className="btn-secondary text-sm"
                  onClick={() => setFilters({ month: '', year: String(currentDate.getFullYear()), dueDateFrom: '', dueDateTo: '' })}
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
