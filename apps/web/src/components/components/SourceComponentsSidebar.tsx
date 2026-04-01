'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Boxes, Plus, Search, Unlink2, X } from 'lucide-react';
import { toast } from 'sonner';
import { componentsApi, dataSourcesApi } from '@/lib/api';
import { cn, formatRelative } from '@/lib/utils';
import { ComponentLocationActions } from './ComponentLocationActions';

export function SourceComponentsSidebar({
  sourceId,
  sourceName,
  isOpen,
  onClose,
}: {
  sourceId: string;
  sourceName: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'linked' | 'all'>('linked');

  const { data: linkedComponents } = useQuery({
    queryKey: ['data-source-components', sourceId],
    queryFn: () => dataSourcesApi.getComponents(sourceId),
    enabled: isOpen,
  });

  const { data: availableComponents } = useQuery({
    queryKey: ['available-components-for-source', search],
    queryFn: () => componentsApi.getAvailable(search || undefined),
    enabled: isOpen,
  });

  const attachMutation = useMutation({
    mutationFn: (componentId: string) => dataSourcesApi.attachComponent(sourceId, componentId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['data-source-components', sourceId] }),
        queryClient.invalidateQueries({ queryKey: ['data-sources'] }),
      ]);
      toast.success('Компонент привязан к источнику');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Не удалось привязать компонент');
    },
  });

  const detachMutation = useMutation({
    mutationFn: (componentId: string) => dataSourcesApi.detachComponent(sourceId, componentId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['data-source-components', sourceId] }),
        queryClient.invalidateQueries({ queryKey: ['data-sources'] }),
      ]);
      toast.success('Компонент отвязан от источника');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Не удалось отвязать компонент');
    },
  });

  const attachedIds = useMemo(
    () => new Set((linkedComponents || []).map((item) => item.component.id)),
    [linkedComponents],
  );

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 bg-slate-950/10 lg:bg-transparent" onClick={onClose} />}
      <aside
        className={cn(
          'fixed bottom-4 right-4 top-20 z-50 w-[400px] max-w-[calc(100vw-32px)] rounded-3xl border border-slate-200 bg-white shadow-2xl transition-transform duration-200',
          isOpen ? 'translate-x-0' : 'translate-x-[110%]',
        )}
      >
        <div className="flex h-full flex-col overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Boxes className="h-4 w-4 text-slate-500" />
                  Компоненты источника
                </div>
                <div className="mt-1 text-xs text-slate-500">{sourceName}</div>
              </div>
              <button
                type="button"
                className="btn-icon h-9 w-9 border border-slate-200 bg-white text-slate-500"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-medium transition',
                  tab === 'linked' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
                onClick={() => setTab('linked')}
              >
                Привязанные
              </button>
              <button
                type="button"
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-medium transition',
                  tab === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
                onClick={() => setTab('all')}
              >
                Все компоненты
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {tab === 'linked' ? (
              !(linkedComponents || []).length ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
                  У источника пока нет привязанных компонентов.
                </div>
              ) : (
                <div className="space-y-3">
                  {(linkedComponents || []).map((link) => (
                    <div key={link.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="page-chip font-mono">{link.component.publicId}</span>
                        <span className="text-xs text-slate-400">{formatRelative(link.createdAt)}</span>
                      </div>
                      <div className="mt-3 text-sm font-semibold text-slate-900">{link.component.name}</div>
                      {link.component.description && (
                        <p className="mt-1 text-sm text-slate-500">{link.component.description}</p>
                      )}
                      <div className="mt-3">
                        <ComponentLocationActions location={link.component.location} />
                      </div>
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => detachMutation.mutate(link.component.id)}
                          disabled={detachMutation.isPending}
                        >
                          <Unlink2 className="h-4 w-4" />
                          Убрать
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    className="input pl-9"
                    placeholder="Поиск по компонентам..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>

                <div className="space-y-3">
                  {(availableComponents || []).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
                      Компоненты не найдены.
                    </div>
                  ) : (
                    (availableComponents || []).map((component) => {
                      const isAttached = attachedIds.has(component.id);
                      return (
                        <div key={component.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="page-chip font-mono">{component.publicId}</span>
                            <span className="page-chip">{component._count?.cardLinks || 0} карточек</span>
                          </div>
                          <div className="mt-3 text-sm font-semibold text-slate-900">{component.name}</div>
                          {component.description && (
                            <p className="mt-1 text-sm text-slate-500">{component.description}</p>
                          )}
                          <div className="mt-3">
                            <ComponentLocationActions location={component.location} />
                          </div>
                          <div className="mt-3 flex justify-end">
                            <button
                              type="button"
                              className={cn(
                                'btn-secondary',
                                isAttached && 'toolbar-button-active cursor-default',
                              )}
                              onClick={() => !isAttached && attachMutation.mutate(component.id)}
                              disabled={isAttached || attachMutation.isPending}
                            >
                              <Plus className="h-4 w-4" />
                              {isAttached ? 'Уже привязан' : 'Привязать'}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
