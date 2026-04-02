'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Plus, Search, Archive, ArchiveRestore, BookOpen, ExternalLink, Trash2, X, Check, Boxes, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { SourceInstructionsSidebar } from '@/components/instructions/SourceInstructionsSidebar';
import { SourceComponentsSidebar } from '@/components/components/SourceComponentsSidebar';
import { SourceReviewProtocolSidebar } from '@/components/review-protocols/SourceReviewProtocolSidebar';
import { EmptyState } from '@/components/shared/EmptyState';
import { dataSourcesApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/lib/store/auth.store';

export default function SourcesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const isAdmin = user?.role === 'ADMIN';
  const isManager = user?.role === 'MANAGER';
  const canEdit = isAdmin || isManager;

  // Redirect USER to dashboard
  useEffect(() => {
    if (user && user.role === 'USER') {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const [search, setSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingSource, setEditingSource] = useState<any | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', website: '' });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [instructionsSource, setInstructionsSource] = useState<any | null>(null);
  const [componentsSource, setComponentsSource] = useState<any | null>(null);
  const [reviewProtocolSource, setReviewProtocolSource] = useState<any | null>(null);
  const isFormModalOpen = (showForm || !!editingSource) && canEdit;

  const { data: sources, isLoading } = useQuery({
    queryKey: ['data-sources', search, includeArchived],
    queryFn: () => dataSourcesApi.getAll(search, includeArchived),
  });

  const modalSource = useMemo(() => {
    if (!editingSource) {
      return null;
    }

    return sources?.find((source: any) => source.id === editingSource.id) || editingSource;
  }, [editingSource, sources]);

  const createMutation = useMutation({
    mutationFn: () => dataSourcesApi.create(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-sources'] });
      toast.success('Источник создан');
      setShowForm(false);
      setFormData({ name: '', description: '', website: '' });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Ошибка'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof formData }) => dataSourcesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-sources'] });
      toast.success('Источник обновлён');
      setEditingSource(null);
      setFormData({ name: '', description: '', website: '' });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Ошибка'),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => dataSourcesApi.toggleArchive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-sources'] });
      toast.success('Статус изменён');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dataSourcesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-sources'] });
      toast.success('Источник удалён');
      setDeleteConfirmId(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Ошибка'),
  });

  const handleEdit = (source: any) => {
    setEditingSource(source);
    setFormData({ name: source.name, description: source.description || '', website: source.website || '' });
    setShowForm(false);
  };

  const closeFormModal = () => {
    setShowForm(false);
    setEditingSource(null);
    setFormData({ name: '', description: '', website: '' });
  };

  if (user?.role === 'USER') return null;

  return (
    <AppLayout>
      <div className="page-container">
        <div className="page-hero">
          <div className="page-hero-body">
            <div className="page-title-row">
              <div className="flex-1 min-w-0">
                <div className="page-kicker">Справочники</div>
                <h1 className="mt-4 text-2xl font-semibold text-slate-900">
                  Источники нормативно-справочной документации
                </h1>
                <p className="page-subtitle">
                  Справочник источников входящих данных, внешних документов и связанных инструкций.
                </p>
              </div>

              {canEdit && (
                <div className="card-action-toolbar">
                  <button
                    className="toolbar-button toolbar-button-primary"
                    onClick={() => { setShowForm(true); setEditingSource(null); setFormData({ name: '', description: '', website: '' }); }}
                  >
                    <Plus className="w-4 h-4" />
                    Добавить источник
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card mb-4">
          <div className="card-body">
            <div className="filter-bar">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Поиск по источникам..."
                  className="input pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(e) => setIncludeArchived(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Показать архивные
              </label>
            </div>
          </div>
        </div>

        {/* Sources table */}
        <div className="card">
          {isLoading ? (
            <div className="card-body space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-10" />)}
            </div>
          ) : !sources?.length ? (
            <EmptyState
              icon={BookOpen}
              title="Источники не найдены"
              description={isAdmin ? 'Добавьте первый источник данных' : 'Справочник пуст'}
            />
          ) : (
            <div className="table-shell">
              <table className="data-table data-table-sources">
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Описание</th>
                    <th>Сайт</th>
                    <th>Создан</th>
                    <th>Статус</th>
                    {canEdit && <th>Действия</th>}
                  </tr>
                </thead>
                <tbody>
                  {sources.map((source: any) => (
                      <tr
                        key={source.id}
                        className={`${!source.isActive ? 'opacity-50' : ''} ${canEdit ? 'cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/60' : ''}`}
                        onClick={() => {
                          if (canEdit) {
                            handleEdit(source);
                          }
                        }}
                      >
                          <td className="font-medium text-gray-800 dark:text-slate-100">{source.name}</td>
                          <td className="text-gray-500 dark:text-slate-400">{source.description || '—'}</td>
                        <td>
                          {source.website ? (
                            <a href={source.website} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary text-sm hover:underline"
                              onClick={(e) => e.stopPropagation()}>
                              <ExternalLink className="w-3 h-3" />Открыть
                            </a>
                          ) : '—'}
                        </td>
                          <td className="text-gray-400 text-xs dark:text-slate-400">{formatDate(source.createdAt)}</td>
                        <td>
                          <span className={`badge ${source.isActive ? 'badge-done' : 'badge-cancelled'}`}>
                            {source.isActive ? 'Активен' : 'Архивный'}
                          </span>
                        </td>
                        {canEdit && (
                          <td>
                            <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                              {isAdmin && (
                                deleteConfirmId === source.id ? (
                                  <>
                                    <button
                                      className="btn-icon text-red-600 hover:bg-red-50"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        deleteMutation.mutate(source.id);
                                      }}
                                      title="Подтвердить удаление"
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                    <button
                                      className="btn-icon"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setDeleteConfirmId(null);
                                      }}
                                      title="Отмена"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    className="btn-icon text-red-400 hover:text-red-600 hover:bg-red-50"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setDeleteConfirmId(source.id);
                                    }}
                                    title="Удалить"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {isFormModalOpen && (
          <div className="app-modal-overlay">
            <div className="app-modal-backdrop" onClick={closeFormModal} />
            <div className="app-modal-panel app-modal-panel-md">
              <div className="app-modal-header">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    {editingSource ? 'Редактирование источника' : 'Новый источник'}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Заполни базовую информацию по источнику НСД.
                  </p>
                </div>
                <button type="button" className="btn-icon" onClick={closeFormModal} title="Закрыть">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="app-modal-body space-y-4">
                <div>
                  <label className="label label-required">Название</label>
                  <input type="text" className="input" placeholder="Например: Росстат"
                    value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Описание</label>
                  <input type="text" className="input" placeholder="Краткое описание источника..."
                    value={formData.description} onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Сайт источника</label>
                  <input type="url" className="input" placeholder="https://rosstat.gov.ru"
                    value={formData.website} onChange={(e) => setFormData((p) => ({ ...p, website: e.target.value }))} />
                </div>
                {modalSource && (
                    <div className="space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                      <button
                      type="button"
                      onClick={() => setInstructionsSource(modalSource)}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-blue-200 hover:bg-blue-50/70 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:border-blue-400/40 dark:hover:bg-blue-500/10"
                    >
                      <span className="flex items-center gap-3">
                        <span className="rounded-xl bg-blue-100 p-2 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                          <BookOpen className="h-4 w-4" />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">Инструкции источника</span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            Связано: {modalSource._count?.instructionLinks || 0}
                          </span>
                        </span>
                      </span>
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-300">Открыть</span>
                    </button>

                      <button
                        type="button"
                        onClick={() => setComponentsSource(modalSource)}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-violet-200 hover:bg-violet-50/70 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:border-violet-400/40 dark:hover:bg-violet-500/10"
                    >
                      <span className="flex items-center gap-3">
                        <span className="rounded-xl bg-violet-100 p-2 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
                          <Boxes className="h-4 w-4" />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">Компоненты источника</span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            Связано: {modalSource._count?.componentLinks || 0}
                          </span>
                        </span>
                      </span>
                      <span className="text-xs font-medium text-violet-600 dark:text-violet-300">Открыть</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewProtocolSource(modalSource)}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-amber-200 hover:bg-amber-50/70 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:border-amber-400/40 dark:hover:bg-amber-500/10"
                    >
                      <span className="flex items-center gap-3">
                        <span className="rounded-xl bg-amber-100 p-2 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
                          <ClipboardList className="h-4 w-4" />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">Протокол проверки</span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            Шаблон проверки для новых карточек этого источника
                          </span>
                        </span>
                      </span>
                      <span className="text-xs font-medium text-amber-600 dark:text-amber-300">Открыть</span>
                    </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="app-modal-actions">
                <div className="flex w-full items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {editingSource && (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => archiveMutation.mutate(editingSource.id)}
                      >
                        {editingSource.isActive ? (
                          <>
                            <Archive className="w-4 h-4" />
                            Архивировать
                          </>
                        ) : (
                          <>
                            <ArchiveRestore className="w-4 h-4" />
                            Восстановить
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <button className="btn-secondary" onClick={closeFormModal}>Отмена</button>
                    <button
                      className="btn-primary"
                      disabled={!formData.name.trim() || createMutation.isPending || updateMutation.isPending}
                      onClick={() => {
                        if (editingSource) {
                          updateMutation.mutate({ id: editingSource.id, data: formData });
                        } else {
                          createMutation.mutate();
                        }
                      }}
                    >
                      {editingSource ? 'Сохранить' : 'Создать'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {instructionsSource && (
          <SourceInstructionsSidebar
            sourceId={instructionsSource.id}
            sourceName={instructionsSource.name}
            isOpen={!!instructionsSource}
            onClose={() => setInstructionsSource(null)}
          />
        )}

        {componentsSource && (
          <SourceComponentsSidebar
            sourceId={componentsSource.id}
            sourceName={componentsSource.name}
            isOpen={!!componentsSource}
            onClose={() => setComponentsSource(null)}
          />
        )}

        {reviewProtocolSource && (
          <SourceReviewProtocolSidebar
            sourceId={reviewProtocolSource.id}
            sourceName={reviewProtocolSource.name}
            isOpen={!!reviewProtocolSource}
            onClose={() => setReviewProtocolSource(null)}
          />
        )}
      </div>
    </AppLayout>
  );
}
