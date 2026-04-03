'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, ClipboardList, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/shared/EmptyState';
import { reviewProtocolsApi } from '@/lib/api/reviewProtocols';
import { formatDate, formatRelative } from '@/lib/utils';
import { useAuthStore } from '@/lib/store/auth.store';

export default function ReviewProtocolsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);

  const { data: protocols, isLoading } = useQuery({
    queryKey: ['review-protocols', search, includeArchived],
    queryFn: () => reviewProtocolsApi.getAll(search || undefined, includeArchived),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => reviewProtocolsApi.toggleArchive(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['review-protocols'] });
      toast.success('Статус протокола изменён');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Не удалось изменить статус'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => reviewProtocolsApi.delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['review-protocols'] });
      toast.success('Протокол удалён');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Не удалось удалить протокол'),
  });

  const stats = useMemo(() => {
    const items = protocols || [];
    return {
      total: items.length,
      active: items.filter((item) => !item.isArchived).length,
      archived: items.filter((item) => item.isArchived).length,
    };
  }, [protocols]);

  return (
    <AppLayout>
      <div className="page-container">
        <div className="page-hero">
          <div className="page-hero-body">
            <div className="page-title-row">
              <div className="flex-1 min-w-0">
                <div className="page-kicker">Проверка результатов</div>
                <h1 className="mt-4 text-2xl font-semibold text-slate-900">Протоколы проверки</h1>
                <p className="page-subtitle">
                  Наборы критериев проверки, которые можно прикреплять к карточкам и источникам данных.
                </p>
              </div>
              <div className="card-action-toolbar">
                <Link href="/review-protocols/new" className="toolbar-button toolbar-button-primary">
                  <Plus className="h-4 w-4" />
                  Новый протокол
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Всего</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{stats.total}</div>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">Активные</div>
            <div className="mt-2 text-3xl font-semibold text-emerald-800">{stats.active}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Архив</div>
            <div className="mt-2 text-3xl font-semibold text-slate-800">{stats.archived}</div>
          </div>
        </div>

        <div className="card mb-4">
          <div className="card-body">
            <div className="filter-bar">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  className="input pl-9"
                  placeholder="Поиск по названию, описанию или коду..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(event) => setIncludeArchived(event.target.checked)}
                  className="rounded border-gray-300"
                />
                Показать архивные
              </label>
            </div>
          </div>
        </div>

        <div className="card">
          {isLoading ? (
            <div className="card-body space-y-2">
              {Array.from({ length: 5 }).map((_, index) => <div key={index} className="skeleton h-12" />)}
            </div>
          ) : !protocols?.length ? (
            <EmptyState icon={ClipboardList} title="Протоколы проверки не найдены" description="Создайте первый протокол или измените фильтры." />
          ) : (
            <div className="table-shell">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Описание</th>
                    <th>Пункты</th>
                    <th>Обновлён</th>
                    <th>Статус</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {protocols.map((protocol) => (
                    <tr key={protocol.id} className={protocol.isArchived ? 'opacity-60' : ''}>
                      <td>
                        <Link href={`/review-protocols/${protocol.publicId}`} className="block">
                          <div className="font-medium text-gray-800">{protocol.title}</div>
                          <div className="mt-1 font-mono text-xs text-slate-400">{protocol.publicId}</div>
                        </Link>
                      </td>
                      <td className="max-w-sm text-gray-500"><div className="line-clamp-2">{protocol.description || '—'}</div></td>
                      <td><span className="page-chip">{protocol.items.length} пунктов</span></td>
                      <td>
                        <div className="text-sm text-gray-500">{formatRelative(protocol.updatedAt)}</div>
                        <div className="mt-1 text-xs text-gray-400">{formatDate(protocol.updatedAt)}</div>
                      </td>
                      <td>
                        <span className={`badge ${protocol.isArchived ? 'badge-cancelled' : 'badge-done'}`}>
                          {protocol.isArchived ? 'Архивный' : 'Активный'}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                          <button type="button" className="btn-icon" onClick={() => archiveMutation.mutate(protocol.id)} title={protocol.isArchived ? 'Восстановить' : 'Архивировать'}>
                            {protocol.isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                          </button>
                          {user?.role === 'ADMIN' && (
                            <button type="button" className="btn-icon text-red-500 hover:bg-red-50" onClick={() => deleteMutation.mutate(protocol.id)} title="Удалить">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
