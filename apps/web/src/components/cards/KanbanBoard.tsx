'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { cardsApi } from '@/lib/api';
import { formatDate, getDueDateIndicator } from '@/lib/utils';
import { useAuthStore } from '@/lib/store/auth.store';

const COLUMNS = [
  { status: 'NEW', label: 'Новое', headerCls: 'bg-blue-100 border-blue-300', bodyCls: 'bg-blue-50/40 border-blue-200' },
  { status: 'IN_PROGRESS', label: 'В работе', headerCls: 'bg-orange-100 border-orange-300', bodyCls: 'bg-orange-50/40 border-orange-200' },
  { status: 'REVIEW', label: 'На проверке', headerCls: 'bg-purple-100 border-purple-300', bodyCls: 'bg-purple-50/40 border-purple-200' },
  { status: 'DONE', label: 'Готово', headerCls: 'bg-green-100 border-green-300', bodyCls: 'bg-green-50/40 border-green-200' },
  { status: 'CANCELLED', label: 'Отменено', headerCls: 'bg-gray-100 border-gray-300', bodyCls: 'bg-gray-50/40 border-gray-200' },
];

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Новое',
  IN_PROGRESS: 'В работе',
  REVIEW: 'На проверке',
  DONE: 'Готово',
  CANCELLED: 'Отменено',
};

const PRIORITY_COLORS: Record<string, string> = {
  OPTIONAL: 'bg-gray-100 text-gray-600',
  NORMAL: 'bg-blue-100 text-blue-700',
  URGENT: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};
const PRIORITY_LABELS: Record<string, string> = {
  OPTIONAL: 'Желательно',
  NORMAL: 'Норм.',
  URGENT: 'Срочно',
  CRITICAL: 'Очень срочно',
};

interface KanbanBoardProps {
  cards: any[];
  queryKey: QueryKey;
}

export function KanbanBoard({ cards, queryKey }: KanbanBoardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const suppressCardOpenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [dragCardStatus, setDragCardStatus] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, setPending] = useState<{ cardId: string; fromStatus: string; toStatus: string } | null>(null);
  const [comment, setComment] = useState('');
  const [reason, setReason] = useState('');
  const [suppressCardOpen, setSuppressCardOpen] = useState(false);
  const [showEmptyColumns, setShowEmptyColumns] = useState(true);

  // After drag-and-drop, suppress the card click briefly so the board does not
  // accidentally navigate into the card details page.
  const blockCardOpenBriefly = () => {
    setSuppressCardOpen(true);
    if (suppressCardOpenTimeoutRef.current) {
      clearTimeout(suppressCardOpenTimeoutRef.current);
    }
    suppressCardOpenTimeoutRef.current = setTimeout(() => {
      setSuppressCardOpen(false);
      suppressCardOpenTimeoutRef.current = null;
    }, 250);
  };

  const statusMutation = useMutation({
    mutationFn: ({ cardId, status, comment, reason, force }: any) =>
      cardsApi.changeStatus(cardId, status, comment || undefined, reason || undefined, force),
    onMutate: async ({ cardId, status }: any) => {
      // Отменяем текущие запросы чтобы не перезаписать оптимистичный апдейт
      await queryClient.cancelQueries({ queryKey });
      // Сохраняем текущее состояние для отката
      const previous = queryClient.getQueryData(queryKey);
      // Сразу двигаем карточку в нужную колонку
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old?.items) return old;
        return { ...old, items: old.items.map((c: any) => c.id === cardId ? { ...c, status } : c) };
      });
      return { previous };
    },
    onSuccess: () => {
      toast.success('Статус изменён');
      closeDialog();
    },
    onError: (err: any, _vars: any, context: any) => {
      // Откатываем при ошибке
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast.error(err?.response?.data?.message || 'Ошибка');
    },
    onSettled: () => {
      // Синхронизируем с сервером в фоне
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setPending(null);
    setComment('');
    setReason('');
  };

  const handleDragStart = (e: React.DragEvent, cardId: string, status: string) => {
    blockCardOpenBriefly();
    setDragCardId(cardId);
    setDragCardStatus(status);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDragCardId(null);
    setDragCardStatus(null);
    setDragOverCol(null);
    blockCardOpenBriefly();
  };

  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(status);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if we're leaving the column entirely
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDragOverCol(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    setDragOverCol(null);
    blockCardOpenBriefly();
    if (!dragCardId || dragCardStatus === targetStatus) return;

    if (isAdmin) {
      statusMutation.mutate({ cardId: dragCardId, status: targetStatus, force: true });
    } else {
      setPending({ cardId: dragCardId, fromStatus: dragCardStatus!, toStatus: targetStatus });
      setDialogOpen(true);
    }
  };

  const confirmChange = (force = false) => {
    if (!pending) return;
    blockCardOpenBriefly();
    statusMutation.mutate({
      cardId: pending.cardId,
      status: pending.toStatus,
      comment,
      reason,
      force,
    });
  };

  const handleCardClick = (publicId: string) => {
    if (suppressCardOpen || dialogOpen || !!dragCardId) {
      return;
    }
    router.push(`/cards/${publicId}`);
  };

  const needsComment = pending?.toStatus === 'IN_PROGRESS' && pending?.fromStatus === 'REVIEW';
  const needsReason = pending?.toStatus === 'CANCELLED';
  const columnsWithCards = useMemo(
    () => COLUMNS.map((col) => ({ ...col, cards: cards.filter((card) => card.status === col.status) })),
    [cards],
  );
  const hiddenColumnsCount = columnsWithCards.filter((col) => col.cards.length === 0).length;
  const visibleColumns =
    showEmptyColumns || cards.length === 0
      ? columnsWithCards
      : columnsWithCards.filter((col) => col.cards.length > 0);

  return (
    <>
      <div className="kanban-shell">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="text-sm text-gray-500">
            {cards.length === 0
              ? 'По текущим фильтрам карточки не найдены'
              : `На доске ${cards.length} карточек`}
          </div>
          {hiddenColumnsCount > 0 && (
            <button
              type="button"
              className="btn-ghost text-sm px-3 py-1.5"
              onClick={() => setShowEmptyColumns((value) => !value)}
            >
              {showEmptyColumns ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showEmptyColumns ? 'Скрыть пустые колонки' : `Показать пустые колонки (${hiddenColumnsCount})`}
            </button>
          )}
        </div>

        {cards.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 px-6 py-16 text-center">
            <div className="text-sm font-medium text-slate-700">Нет карточек для отображения</div>
            <div className="text-sm text-gray-500 mt-1">
              Попробуйте изменить фильтры или переключить период.
            </div>
          </div>
        ) : (
        <div className="kanban-track">
        {visibleColumns.map((col) => {
          const colCards = col.cards;
          const isOver = dragOverCol === col.status;

          return (
            <div
              key={col.status}
              className={`kanban-column border-2 transition-all ${col.bodyCls} ${isOver ? 'ring-2 ring-primary/50 scale-[1.01]' : ''}`}
              onDragOver={(e) => handleDragOver(e, col.status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.status)}
            >
              <div className={`kanban-column-header border-b-2 ${col.headerCls}`}>
                <span className="font-semibold text-sm text-gray-700">{col.label}</span>
                <span className="text-xs bg-white/70 rounded-full px-2 py-0.5 text-gray-500 font-medium">
                  {colCards.length}
                </span>
              </div>

              <div className="kanban-column-body">
                {colCards.map((card) => {
                  const ind = getDueDateIndicator(card.dueDate, card.status);
                  const hasNoSourceMaterials = !!card.withoutSourceMaterials && (card._count?.sourceMaterials ?? 0) === 0;
                  return (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, card.id, card.status)}
                      onDragEnd={handleDragEnd}
                      onClick={() => handleCardClick(card.publicId)}
                      className={`kanban-card ${
                        dragCardId === card.id ? 'opacity-40 scale-95' : ''
                      } ${
                        ind === 'red' ? 'border-l-4 border-l-red-400 border-t border-r border-b border-gray-200' :
                        ind === 'orange' ? 'border-l-4 border-l-orange-400 border-t border-r border-b border-gray-200' :
                        'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="font-mono text-[10px] text-gray-400">{card.publicId}</span>
                        {card.priority && card.priority !== 'NORMAL' && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[card.priority] || ''}`}>
                            {PRIORITY_LABELS[card.priority] || card.priority}
                          </span>
                        )}
                      </div>
                      {hasNoSourceMaterials && (
                        <div className="mb-2">
                          <span className="attention-chip">
                            <AlertTriangle className="w-3 h-3" />
                            Информационная
                          </span>
                        </div>
                      )}
                      <p className="text-sm font-medium text-gray-800 line-clamp-2 leading-snug">
                        {card.dataSource?.name || '—'}
                        {card.extraTitle && (
                          <span className="text-gray-500 font-normal"> — {card.extraTitle}</span>
                        )}
                      </p>
                      {card.dueDate && (
                        <p className={`text-xs mt-1.5 ${ind === 'red' ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                          Срок: {formatDate(card.dueDate)}
                        </p>
                      )}
                      {card.executor && (
                        <p className="text-xs text-gray-400 mt-1 truncate">{card.executor.fullName}</p>
                      )}
                    </div>
                  );
                })}
                {colCards.length === 0 && !isOver && (
                  <div className="text-center py-6 text-xs text-gray-400">Пусто</div>
                )}
                {isOver && (
                  <div className="border-2 border-dashed border-primary/40 rounded-md h-16 flex items-center justify-center text-xs text-primary/60">
                    Перетащите сюда
                  </div>
                )}
              </div>
            </div>
          );
        })}
        </div>
        )}
      </div>

      {/* Status change dialog */}
      {dialogOpen && pending && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="font-semibold text-gray-800 mb-1">Изменение статуса</h3>
            <p className="text-sm text-gray-500 mb-4">
              {STATUS_LABELS[pending.fromStatus]} → <strong className="text-gray-700">{STATUS_LABELS[pending.toStatus]}</strong>
            </p>

            {needsComment && (
              <div className="mb-3">
                <label className="label label-required">Причина возврата</label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  placeholder="Укажите причину возврата с проверки..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </div>
            )}

            {needsReason && (
              <div className="mb-3">
                <label className="label label-required">Причина отмены</label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  placeholder="Укажите причину отмены..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            )}

            {!needsComment && !needsReason && (
              <div className="mb-3">
                <label className="label">Комментарий (необязательно)</label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  placeholder="Дополнительный комментарий..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </div>
            )}

            <div className="flex gap-2 justify-end mt-4">
              <button className="btn-secondary" onClick={closeDialog}>
                Отмена
              </button>
              {isAdmin && (
                <button
                  className="btn-secondary border-orange-300 text-orange-700 hover:bg-orange-50"
                  onClick={() => confirmChange(true)}
                  disabled={statusMutation.isPending}
                >
                  Принудительно
                </button>
              )}
              <button
                className="btn-primary"
                onClick={() => confirmChange(false)}
                disabled={
                  statusMutation.isPending ||
                  (needsComment && !comment.trim()) ||
                  (needsReason && !reason.trim())
                }
              >
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
