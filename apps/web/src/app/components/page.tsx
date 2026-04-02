'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, Boxes, Check, Plus, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/shared/EmptyState';
import { componentsApi, type ComponentItem } from '@/lib/api/components';
import { formatDate, formatRelative } from '@/lib/utils';
import { useAuthStore } from '@/lib/store/auth.store';
import { ComponentLocationActions } from '@/components/components/ComponentLocationActions';

export default function ComponentsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingComponent, setEditingComponent] = useState<ComponentItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', location: '' });
  const isFormModalOpen = showForm || !!editingComponent;

  const isAdmin = user?.role === 'ADMIN';
  const canManageComponent = (component: ComponentItem | null) =>
    !!component && (isAdmin || component.createdById === user?.id);

  const { data: components, isLoading } = useQuery({
    queryKey: ['components', search, includeArchived],
    queryFn: () => componentsApi.getAll(search || undefined, includeArchived),
  });

  const stats = useMemo(() => {
    const items = components || [];
    return {
      total: items.length,
      active: items.filter((item) => !item.isArchived).length,
      linkedCards: items.reduce((sum, item) => sum + (item._count?.cardLinks || 0), 0),
    };
  }, [components]);

  const resetForm = () => {
    setFormData({ name: '', description: '', location: '' });
    setEditingComponent(null);
    setShowForm(false);
  };

  const createMutation = useMutation({
    mutationFn: () => componentsApi.create(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components'] });
      toast.success('Компонент создан');
      resetForm();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Ошибка создания'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof formData }) => componentsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components'] });
      toast.success('Компонент обновлён');
      resetForm();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Ошибка обновления'),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => componentsApi.toggleArchive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components'] });
      toast.success('Статус компонента изменён');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Ошибка'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => componentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components'] });
      toast.success('Компонент удалён');
      setDeleteConfirmId(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Ошибка удаления'),
  });

  const handleOpen = (component: ComponentItem) => {
    setEditingComponent(component);
    setFormData({
      name: component.name,
      description: component.description || '',
      location: component.location,
    });
    setShowForm(false);
  };

  return (
    <AppLayout>
      <div className="page-container">
        <div className="page-hero">
          <div className="page-hero-body">
            <div className="page-title-row">
              <div className="flex-1 min-w-0">
                <div className="page-kicker">Инструменты обработки</div>
                <h1 className="mt-4 text-2xl font-semibold text-slate-900">Компоненты</h1>
                <p className="page-subtitle">
                  Программы, скрипты, облачные сервисы и другие инструменты, которые используются при обработке исходных данных.
                </p>
              </div>
              <div className="card-action-toolbar">
                <button
                  type="button"
                  className="toolbar-button toolbar-button-primary"
                  onClick={() => {
                    setShowForm(true);
                    setEditingComponent(null);
                    setFormData({ name: '', description: '', location: '' });
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Новый компонент
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Всего</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{stats.total}</div>
            <div className="mt-1 text-sm text-slate-500">в текущей выборке</div>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">Активные</div>
            <div className="mt-2 text-3xl font-semibold text-emerald-800">{stats.active}</div>
            <div className="mt-1 text-sm text-emerald-700">доступны для привязки</div>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Использование</div>
            <div className="mt-2 text-3xl font-semibold text-blue-800">{stats.linkedCards}</div>
            <div className="mt-1 text-sm text-blue-700">привязок к карточкам</div>
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
                  placeholder="Поиск по названию, описанию, коду или расположению..."
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
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="skeleton h-12" />
              ))}
            </div>
          ) : !components?.length ? (
            <EmptyState
              icon={Boxes}
              title="Компоненты не найдены"
              description="Создайте первый компонент или измените фильтры."
            />
          ) : (
            <div className="table-shell">
            <table className={`data-table data-table-components ${isAdmin ? 'data-table-components-admin' : 'data-table-components-readonly'}`}>
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Описание</th>
                  <th>Расположение</th>
                  <th>Обновлён</th>
                  <th>Статус</th>
                  {isAdmin && <th>Действия</th>}
                </tr>
              </thead>
              <tbody>
                {components.map((component) => {
                  const canEdit = canManageComponent(component);
                  return (
                    <tr
                      key={component.id}
                      className={`${component.isArchived ? 'opacity-60' : ''} cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/60`}
                      onClick={() => {
                        handleOpen(component);
                      }}
                    >
                      <td>
                        <div className="font-medium text-gray-800 dark:text-slate-100">{component.name}</div>
                        <div className="mt-1 font-mono text-xs text-slate-400">{component.publicId}</div>
                      </td>
                      <td className="max-w-sm text-gray-500">
                        <div className="line-clamp-2">{component.description || '—'}</div>
                      </td>
                      <td className="max-w-sm">
                        <div className="min-w-0">
                          <span
                            className="block truncate text-sm text-gray-500"
                            title={component.location}
                          >
                            {component.location}
                          </span>
                          <ComponentLocationActions
                            location={component.location}
                            compact
                            className="mt-2"
                          />
                        </div>
                      </td>
                      <td>
                        <div className="text-sm text-gray-500">{formatRelative(component.updatedAt)}</div>
                        <div className="mt-1 text-xs text-gray-400">{formatDate(component.updatedAt)}</div>
                      </td>
                      <td>
                        <span className={`badge ${component.isArchived ? 'badge-cancelled' : 'badge-done'}`}>
                          {component.isArchived ? 'Архивный' : 'Активный'}
                        </span>
                      </td>
                      {isAdmin && (
                      <td>
                        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={(event) => {
                              event.stopPropagation();
                              archiveMutation.mutate(component.id);
                            }}
                            title={component.isArchived ? 'Восстановить' : 'Архивировать'}
                          >
                            {component.isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                          </button>

                          {deleteConfirmId === component.id ? (
                            <>
                              <button
                                type="button"
                                className="btn-icon text-red-600 hover:bg-red-50"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  deleteMutation.mutate(component.id);
                                }}
                                title="Подтвердить удаление"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                className="btn-icon"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setDeleteConfirmId(null);
                                }}
                                title="Отмена"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="btn-icon text-red-400 hover:bg-red-50 hover:text-red-600"
                              onClick={(event) => {
                                event.stopPropagation();
                                setDeleteConfirmId(component.id);
                              }}
                              title="Удалить"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>

        {isFormModalOpen && (
          <div className="app-modal-overlay">
            <div className="app-modal-backdrop" onClick={resetForm} />
            <div className="app-modal-panel app-modal-panel-md">
              <div className="app-modal-header">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    {editingComponent ? (canManageComponent(editingComponent) ? 'Редактирование компонента' : 'Просмотр компонента') : 'Новый компонент'}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Укажи название, описание и расположение инструмента обработки.
                  </p>
                </div>
                <button type="button" className="btn-icon" onClick={resetForm} title="Закрыть">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="app-modal-body space-y-4">
                <div>
                  <label className="label label-required">Название</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Например: Excel-макрос расчёта индексов"
                    value={formData.name}
                    disabled={!!editingComponent && !canManageComponent(editingComponent)}
                    onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Описание</label>
                  <textarea
                    className="input min-h-24 resize-none"
                    placeholder="Что делает компонент и в каких сценариях используется..."
                    value={formData.description}
                    disabled={!!editingComponent && !canManageComponent(editingComponent)}
                    onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="label label-required">Расположение</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="https://..., \\server\\share, C:\\Scripts\\parser.py"
                    value={formData.location}
                    disabled={!!editingComponent && !canManageComponent(editingComponent)}
                    onChange={(event) => setFormData((prev) => ({ ...prev, location: event.target.value }))}
                  />
                </div>
              </div>
              <div className="app-modal-actions">
                <div className="flex w-full items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {editingComponent && (
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={!canManageComponent(editingComponent)}
                        title={
                          !canManageComponent(editingComponent)
                            ? 'Архивирование доступно автору компонента или администратору.'
                            : undefined
                        }
                        onClick={() => {
                          if (!canManageComponent(editingComponent)) {
                            return
                          }
                          archiveMutation.mutate(editingComponent.id)
                        }}
                      >
                        {editingComponent.isArchived ? (
                          <>
                            <ArchiveRestore className="h-4 w-4" />
                            Восстановить
                          </>
                        ) : (
                          <>
                            <Archive className="h-4 w-4" />
                            Архивировать
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <button type="button" className="btn-secondary" onClick={resetForm}>
                      {editingComponent && !canManageComponent(editingComponent) ? 'Закрыть' : 'Отмена'}
                    </button>
                    {(!editingComponent || canManageComponent(editingComponent)) && (
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={!formData.name.trim() || !formData.location.trim() || createMutation.isPending || updateMutation.isPending}
                        onClick={() => {
                          if (editingComponent) {
                            updateMutation.mutate({ id: editingComponent.id, data: formData });
                          } else {
                            createMutation.mutate();
                          }
                        }}
                      >
                        {editingComponent ? 'Сохранить' : 'Создать'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
