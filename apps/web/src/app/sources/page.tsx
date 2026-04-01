'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Plus, Search, Archive, ArchiveRestore, Edit, BookOpen, ExternalLink, Trash2, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { SourceInstructionsSidebar } from '@/components/instructions/SourceInstructionsSidebar';
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

  const { data: sources, isLoading } = useQuery({
    queryKey: ['data-sources', search, includeArchived],
    queryFn: () => dataSourcesApi.getAll(search, includeArchived),
  });

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

  const handleCancelEdit = () => {
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

        {/* Create form */}
        {showForm && canEdit && (
          <div className="card mb-4">
            <div className="card-header">
              <h2 className="font-medium text-gray-700">Новый источник</h2>
            </div>
            <div className="card-body space-y-3">
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
              <div className="flex gap-2">
                <button className="btn-primary" disabled={!formData.name.trim()} onClick={() => createMutation.mutate()}>
                  Создать
                </button>
                <button className="btn-secondary" onClick={() => setShowForm(false)}>Отмена</button>
              </div>
            </div>
          </div>
        )}

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
            <table className="data-table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Описание</th>
                  <th>Сайт</th>
                  <th>Инструкции</th>
                  <th>Карточек</th>
                  <th>Создан</th>
                  <th>Статус</th>
                  {canEdit && <th>Действия</th>}
                </tr>
              </thead>
              <tbody>
                {sources.map((source: any) => (
                  <>
                    <tr key={source.id} className={!source.isActive ? 'opacity-50' : ''}>
                      <td className="font-medium text-gray-800">{source.name}</td>
                      <td className="text-gray-500 max-w-xs truncate">{source.description || '—'}</td>
                      <td>
                        {source.website ? (
                          <a href={source.website} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary text-sm hover:underline"
                            onClick={(e) => e.stopPropagation()}>
                            <ExternalLink className="w-3 h-3" />Открыть
                          </a>
                        ) : '—'}
                      </td>
                      <td className="text-gray-500">{source._count?.instructionLinks || 0}</td>
                      <td className="text-gray-500">{source._count?.cards || 0}</td>
                      <td className="text-gray-400 text-xs">{formatDate(source.createdAt)}</td>
                      <td>
                        <span className={`badge ${source.isActive ? 'badge-done' : 'badge-cancelled'}`}>
                          {source.isActive ? 'Активен' : 'Архивный'}
                        </span>
                      </td>
                      {canEdit && (
                        <td>
                          <div className="flex items-center gap-1">
                            <button
                              className="btn-icon"
                              onClick={() => setInstructionsSource(source)}
                              title="Инструкции источника"
                            >
                              <BookOpen className="w-4 h-4" />
                            </button>
                            <button className="btn-icon" onClick={() => handleEdit(source)} title="Редактировать">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              className="btn-icon"
                              onClick={() => archiveMutation.mutate(source.id)}
                              title={source.isActive ? 'Архивировать' : 'Восстановить'}
                            >
                              {source.isActive ? <Archive className="w-4 h-4" /> : <ArchiveRestore className="w-4 h-4" />}
                            </button>
                            {isAdmin && (
                              deleteConfirmId === source.id ? (
                                <>
                                  <button
                                    className="btn-icon text-red-600 hover:bg-red-50"
                                    onClick={() => deleteMutation.mutate(source.id)}
                                    title="Подтвердить удаление"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button className="btn-icon" onClick={() => setDeleteConfirmId(null)} title="Отмена">
                                    <X className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  className="btn-icon text-red-400 hover:text-red-600 hover:bg-red-50"
                                  onClick={() => setDeleteConfirmId(source.id)}
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
                    {/* Inline edit row */}
                    {editingSource?.id === source.id && (
                      <tr key={`edit-${source.id}`} className="bg-blue-50">
                        <td colSpan={canEdit ? 8 : 7} className="p-4">
                          <div className="grid grid-cols-3 gap-3 mb-3">
                            <div>
                              <label className="label label-required">Название</label>
                              <input type="text" className="input" value={formData.name}
                                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} />
                            </div>
                            <div>
                              <label className="label">Описание</label>
                              <input type="text" className="input" value={formData.description}
                                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} />
                            </div>
                            <div>
                              <label className="label">Сайт</label>
                              <input type="url" className="input" value={formData.website}
                                onChange={(e) => setFormData((p) => ({ ...p, website: e.target.value }))} />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              className="btn-primary text-xs px-3 py-1.5"
                              disabled={!formData.name.trim() || updateMutation.isPending}
                              onClick={() => updateMutation.mutate({ id: source.id, data: formData })}
                            >
                              Сохранить
                            </button>
                            <button className="btn-secondary text-xs px-3 py-1.5" onClick={handleCancelEdit}>
                              Отмена
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {instructionsSource && (
          <SourceInstructionsSidebar
            sourceId={instructionsSource.id}
            sourceName={instructionsSource.name}
            isOpen={!!instructionsSource}
            onClose={() => setInstructionsSource(null)}
          />
        )}
      </div>
    </AppLayout>
  );
}
