'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Plus, Search, Unlink2, X } from 'lucide-react';
import { toast } from 'sonner';
import { reviewProtocolsApi } from '@/lib/api/reviewProtocols';
import { cn } from '@/lib/utils';

export function SourceReviewProtocolSidebar({
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

  const { data: linkedProtocol } = useQuery({
    queryKey: ['data-source-review-protocol', sourceId],
    queryFn: () => reviewProtocolsApi.getDataSourceProtocol(sourceId),
    enabled: isOpen,
  });

  const { data: availableProtocols } = useQuery({
    queryKey: ['available-review-protocols-source', search],
    queryFn: () => reviewProtocolsApi.getAvailable(search || undefined),
    enabled: isOpen,
  });

  const attachMutation = useMutation({
    mutationFn: (protocolId: string) => reviewProtocolsApi.attachToDataSource(sourceId, protocolId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['data-source-review-protocol', sourceId] }),
        queryClient.invalidateQueries({ queryKey: ['data-sources'] }),
      ]);
      toast.success('Протокол привязан к источнику');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Не удалось привязать протокол'),
  });

  const detachMutation = useMutation({
    mutationFn: () => reviewProtocolsApi.detachFromDataSource(sourceId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['data-source-review-protocol', sourceId] }),
        queryClient.invalidateQueries({ queryKey: ['data-sources'] }),
      ]);
      toast.success('Протокол отвязан от источника');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Не удалось отвязать протокол'),
  });

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 bg-slate-950/10 lg:bg-transparent" onClick={onClose} />}
      <aside
        className={cn(
          'fixed bottom-4 right-4 top-20 z-50 w-[420px] max-w-[calc(100vw-32px)] rounded-3xl border border-slate-200 bg-white shadow-2xl transition-transform duration-200',
          isOpen ? 'translate-x-0' : 'translate-x-[110%]',
        )}
      >
        <div className="flex h-full flex-col overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <ClipboardList className="h-4 w-4 text-slate-500" />
                  Протокол источника
                </div>
                <div className="mt-1 text-xs text-slate-500">{sourceName}</div>
              </div>
              <button type="button" className="btn-icon h-9 w-9 border border-slate-200 bg-white text-slate-500" onClick={onClose}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {linkedProtocol ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="page-chip font-mono">{linkedProtocol.publicId}</span>
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-900">{linkedProtocol.title}</div>
                {linkedProtocol.description && <p className="mt-1 text-sm text-slate-500">{linkedProtocol.description}</p>}
                <div className="mt-2 text-xs text-slate-400">{linkedProtocol.items.length} пунктов проверки</div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link href={`/review-protocols/${linkedProtocol.publicId}`} className="btn-secondary">Открыть</Link>
                  <button type="button" className="btn-secondary" onClick={() => detachMutation.mutate()} disabled={detachMutation.isPending}>
                    <Unlink2 className="h-4 w-4" />
                    Убрать
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
                У источника пока нет прикреплённого протокола.
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" placeholder="Поиск по названию протокола..." value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>

            <div className="space-y-3">
              {(availableProtocols || []).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
                  Протоколы не найдены.
                </div>
              ) : (
                (availableProtocols || []).map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="page-chip font-mono">{item.publicId}</span>
                    </div>
                    <div className="mt-3 text-sm font-semibold text-slate-900">{item.title}</div>
                    {item.description && <p className="mt-1 text-sm text-slate-500">{item.description}</p>}
                    <div className="mt-2 text-xs text-slate-400">{item.items.length} пунктов проверки</div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <Link href={`/review-protocols/${item.publicId}`} className="btn-secondary">Открыть</Link>
                      <button type="button" className="btn-secondary" onClick={() => attachMutation.mutate(item.id)} disabled={attachMutation.isPending}>
                        <Plus className="h-4 w-4" />
                        Привязать
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
