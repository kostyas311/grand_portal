'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { MentionText } from '@/components/shared/MentionText';
import { reviewProtocolsApi, type CardReviewProtocol } from '@/lib/api/reviewProtocols';
import { cn } from '@/lib/utils';

export function CardReviewProtocolSidebar({
  cardId,
  isOpen,
  onClose,
  protocol,
  canManage,
}: {
  cardId: string;
  isOpen: boolean;
  onClose: () => void;
  protocol: CardReviewProtocol | null | undefined;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: availableProtocols } = useQuery({
    queryKey: ['available-review-protocols', search],
    queryFn: () => reviewProtocolsApi.getAvailable(search || undefined),
    enabled: isOpen && canManage,
  });

  const attachedProtocolId = protocol?.sourceProtocol?.id || null;

  const attachMutation = useMutation({
    mutationFn: (protocolId: string) => reviewProtocolsApi.attachToCard(cardId, protocolId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['card', cardId] }),
        queryClient.invalidateQueries({ queryKey: ['card-review-protocol', cardId] }),
      ]);
      toast.success('Протокол прикреплён к карточке');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Не удалось прикрепить протокол'),
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
                  Протокол проверки карточки
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Здесь можно прикрепить шаблон проверки или заменить уже прикреплённый.
                </div>
              </div>
              <button type="button" className="btn-icon h-9 w-9 border border-slate-200 bg-white text-slate-500" onClick={onClose}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {canManage && (
              <>
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
                        {item.description && (
                          <p className="mt-1 text-sm text-slate-500">
                            <MentionText text={item.description} />
                          </p>
                        )}
                        <div className="mt-2 text-xs text-slate-400">{item.items.length} пунктов проверки</div>
                        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                          {attachedProtocolId === item.id && (
                            <button type="button" className="btn-secondary toolbar-button-active cursor-default" disabled>
                              <Plus className="h-4 w-4" />
                              Вложен
                            </button>
                          )}
                          {attachedProtocolId !== item.id && (
                            <button type="button" className="btn-secondary" onClick={() => attachMutation.mutate(item.id)} disabled={attachMutation.isPending}>
                              <Plus className="h-4 w-4" />
                              Прикрепить
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
