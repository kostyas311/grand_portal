'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarRange, CheckCircle2, Loader2, Pencil, Plus, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/shared/EmptyState';
import { useAuthStore } from '@/lib/store/auth.store';
import { sprintsApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';

function toDateInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

function getNextMonthRange(baseDate?: string) {
  const source = baseDate ? new Date(baseDate) : new Date();
  const year = source.getUTCFullYear();
  const month = source.getUTCMonth() + 1;
  const next = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0));

  return {
    startDate: toDateInput(next),
    endDate: toDateInput(end),
  };
}

function getDefaultSprintName(baseDate?: string) {
  const { startDate } = getNextMonthRange(baseDate);
  const date = new Date(startDate);
  return new Intl.DateTimeFormat('ru-RU', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .format(date)
    .replace(/^\p{L}/u, (char) => char.toUpperCase());
}

export default function AdminSprintsPage() {
  const { user } = useAuthStore();
  const canManageSprints = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [editingSprint, setEditingSprint] = useState<any | null>(null);
  const [createForm, setCreateForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
  });
  const [closeForm, setCloseForm] = useState({
    nextSprintName: '',
    nextSprintStartDate: '',
    nextSprintEndDate: '',
    transferOpenCards: true,
  });

  const { data: sprints = [], isLoading } = useQuery({
    queryKey: ['sprints'],
    queryFn: () => sprintsApi.getAll(),
    enabled: canManageSprints,
  });

  const currentSprint = useMemo(
    () => sprints.find((sprint) => sprint.status === 'IN_PROGRESS') ?? null,
    [sprints],
  );
  const closedSprints = useMemo(
    () => sprints.filter((sprint) => sprint.status === 'CLOSED'),
    [sprints],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingSprint) {
        return sprintsApi.update(editingSprint.id, createForm);
      }
      return sprintsApi.create(createForm);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sprints'] });
      toast.success(editingSprint ? 'Спринт обновлён' : 'Спринт создан');
      setShowCreateModal(false);
      setEditingSprint(null);
      setCreateForm({ name: '', startDate: '', endDate: '' });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Не удалось сохранить спринт');
    },
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      if (!currentSprint) {
        throw new Error('Активный спринт не найден');
      }
      return sprintsApi.close(currentSprint.id, closeForm);
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['sprints'] });
      toast.success(
        result.nextSprint
          ? `Спринт завершён, открыт «${result.nextSprint.name}»`
          : 'Спринт завершён',
      );
      setShowCloseModal(false);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Не удалось завершить спринт');
    },
  });

  const transferMutation = useMutation({
    mutationFn: ({ fromSprintId, targetSprintId }: { fromSprintId: string; targetSprintId: string }) =>
      sprintsApi.transferOpenCards(fromSprintId, targetSprintId),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['sprints'] });
      await queryClient.invalidateQueries({ queryKey: ['all-cards'] });
      await queryClient.invalidateQueries({ queryKey: ['all-cards-kanban'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-list'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-kanban'] });
      toast.success(`Перенесено карточек: ${result.movedCount}`);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Не удалось перенести карточки');
    },
  });

  const openCreate = () => {
    const range = getNextMonthRange(currentSprint?.endDate);
    setEditingSprint(null);
    setCreateForm({
      name: getDefaultSprintName(currentSprint?.endDate),
      startDate: range.startDate,
      endDate: range.endDate,
    });
    setShowCreateModal(true);
  };

  const openEdit = (sprint: any) => {
    setEditingSprint(sprint);
    setCreateForm({
      name: sprint.name,
      startDate: toDateInput(new Date(sprint.startDate)),
      endDate: toDateInput(new Date(sprint.endDate)),
    });
    setShowCreateModal(true);
  };

  const openClose = () => {
    const range = getNextMonthRange(currentSprint?.endDate);
    setCloseForm({
      nextSprintName: getDefaultSprintName(currentSprint?.endDate),
      nextSprintStartDate: range.startDate,
      nextSprintEndDate: range.endDate,
      transferOpenCards: true,
    });
    setShowCloseModal(true);
  };

  if (!canManageSprints) {
    return (
      <AppLayout>
        <div className="page-container">
          <EmptyState
            icon={CalendarRange}
            title="Раздел недоступен"
            description="Управление рабочими спринтами доступно только администратору и руководителю."
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="page-container">
        <div className="page-hero">
          <div className="page-hero-body">
            <div className="page-title-row">
              <div className="flex-1 min-w-0">
                <div className="page-kicker">Администрирование</div>
                <h1 className="mt-4 text-2xl font-semibold text-slate-900">Управление спринтами</h1>
                <p className="page-subtitle">
                  Спринт определяет рабочий интервал, в рамках которого ведётся планирование, выполнение и перенос незавершённых карточек.
                </p>
              </div>

              <div className="card-action-toolbar">
                <button className="toolbar-button toolbar-button-primary" onClick={openCreate}>
                  <Plus className="w-4 h-4" />
                  Создать спринт
                </button>
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="card">
            <div className="card-body space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="skeleton h-20" />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {currentSprint ? (
              <div className="section-surface">
                <div className="section-surface-header">
                  <div>
                    <h2 className="section-surface-title">Текущий спринт</h2>
                    <p className="section-surface-subtitle">Именно этот спринт используется по умолчанию на карточных экранах.</p>
                  </div>
                  <div className="card-action-toolbar">
                    <button className="toolbar-button toolbar-button-secondary" onClick={() => openEdit(currentSprint)}>
                      <Pencil className="w-4 h-4" />
                      Изменить
                    </button>
                    <button className="toolbar-button toolbar-button-primary" onClick={openClose}>
                      <CheckCircle2 className="w-4 h-4" />
                      Завершить спринт
                    </button>
                  </div>
                </div>
                <div className="card-body grid gap-4 md:grid-cols-3">
                  <div className="soft-note">
                    <div className="label">Название</div>
                    <div className="text-base font-semibold text-slate-900">{currentSprint.name}</div>
                  </div>
                  <div className="soft-note">
                    <div className="label">Границы</div>
                    <div className="text-sm text-slate-700">
                      {formatDate(currentSprint.startDate)} - {formatDate(currentSprint.endDate)}
                    </div>
                  </div>
                  <div className="soft-note">
                    <div className="label">Карточек</div>
                    <div className="text-base font-semibold text-slate-900">{currentSprint._count?.cards ?? 0}</div>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={CalendarRange}
                title="Активный спринт не создан"
                description="Создайте первый рабочий спринт, и новые карточки начнут привязываться именно к нему."
                action={
                  <button className="btn-primary" onClick={openCreate}>
                    <Plus className="w-4 h-4" />
                    Создать первый спринт
                  </button>
                }
              />
            )}

            <div className="section-surface">
              <div className="section-surface-header">
                <div>
                  <h2 className="section-surface-title">История спринтов</h2>
                  <p className="section-surface-subtitle">Закрытые спринты остаются доступными для отчётности и ручного переноса хвостов.</p>
                </div>
              </div>
              {!closedSprints.length ? (
                <div className="card-body text-sm text-slate-500">Закрытых спринтов пока нет.</div>
              ) : (
                <div className="table-shell">
                  <table className="w-full table-auto text-sm">
                    <thead>
                      <tr>
                        <th className="bg-slate-50 px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">Название</th>
                        <th className="bg-slate-50 px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">Границы</th>
                        <th className="bg-slate-50 px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 whitespace-nowrap">Карточек</th>
                        <th className="bg-slate-50 px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 whitespace-nowrap">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {closedSprints.map((sprint) => (
                        <tr key={sprint.id}>
                          <td className="border-b border-slate-100 px-4 py-4 font-medium text-slate-800">{sprint.name}</td>
                          <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-500 whitespace-nowrap">
                            {formatDate(sprint.startDate)} - {formatDate(sprint.endDate)}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-500 whitespace-nowrap">
                            {sprint._count?.cards ?? 0}
                          </td>
                          <td className="border-b border-slate-100 px-4 py-4">
                            <div className="flex min-w-[260px] flex-wrap items-center justify-end gap-2">
                              <button className="btn-secondary text-xs px-3 py-1.5" onClick={() => openEdit(sprint)}>
                                <Pencil className="w-3.5 h-3.5" />
                                Изменить
                              </button>
                              {currentSprint && (
                                <button
                                  className="btn-ghost text-xs px-3 py-1.5"
                                  disabled={transferMutation.isPending}
                                  onClick={() =>
                                    transferMutation.mutate({
                                      fromSprintId: sprint.id,
                                      targetSprintId: currentSprint.id,
                                    })
                                  }
                                >
                                  <RefreshCcw className="w-3.5 h-3.5" />
                                  Перенести
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
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCreateModal(false)} />
          <div className="relative mx-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">
              {editingSprint ? 'Изменение спринта' : 'Создание спринта'}
            </h3>
            <div className="mt-4 space-y-4">
              <div>
                <label className="label label-required">Название</label>
                <input
                  className="input"
                  value={createForm.name}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Например: Май 2026"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label label-required">Дата начала</label>
                  <input
                    type="date"
                    className="input"
                    value={createForm.startDate}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, startDate: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="label label-required">Дата окончания</label>
                  <input
                    type="date"
                    className="input"
                    value={createForm.endDate}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, endDate: event.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                Отмена
              </button>
              <button
                className="btn-primary"
                disabled={!createForm.name || !createForm.startDate || !createForm.endDate || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  'Сохранить'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCloseModal && currentSprint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCloseModal(false)} />
          <div className="relative mx-4 w-full max-w-xl rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Завершение спринта</h3>
            <p className="mt-1 text-sm text-slate-500">
              Текущий спринт будет закрыт. При желании можно сразу открыть следующий и перенести в него незавершённые карточки.
            </p>
            <div className="mt-4 space-y-4">
              <div className="soft-note text-sm text-slate-700">
                Закрывается: <span className="font-medium text-slate-900">{currentSprint.name}</span>
              </div>
              <div>
                <label className="label label-required">Название следующего спринта</label>
                <input
                  className="input"
                  value={closeForm.nextSprintName}
                  onChange={(event) => setCloseForm((prev) => ({ ...prev, nextSprintName: event.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label label-required">Дата начала</label>
                  <input
                    type="date"
                    className="input"
                    value={closeForm.nextSprintStartDate}
                    onChange={(event) => setCloseForm((prev) => ({ ...prev, nextSprintStartDate: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="label label-required">Дата окончания</label>
                  <input
                    type="date"
                    className="input"
                    value={closeForm.nextSprintEndDate}
                    onChange={(event) => setCloseForm((prev) => ({ ...prev, nextSprintEndDate: event.target.value }))}
                  />
                </div>
              </div>
              <label className="soft-note flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={closeForm.transferOpenCards}
                  onChange={(event) =>
                    setCloseForm((prev) => ({ ...prev, transferOpenCards: event.target.checked }))
                  }
                />
                <div>
                  <div className="text-sm font-medium text-slate-700">Перенести незавершённые карточки</div>
                  <div className="text-xs text-slate-500">Будут перенесены карточки в статусах Новое, В работе и На проверке.</div>
                </div>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setShowCloseModal(false)}>
                Отмена
              </button>
              <button
                className="btn-primary"
                disabled={
                  !closeForm.nextSprintName ||
                  !closeForm.nextSprintStartDate ||
                  !closeForm.nextSprintEndDate ||
                  closeMutation.isPending
                }
                onClick={() => closeMutation.mutate()}
              >
                {closeMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Выполняется...
                  </>
                ) : (
                  'Завершить и открыть следующий'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
