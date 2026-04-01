'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Ban,
  Bell,
  BellRing,
  CheckCheck,
  CheckCircle2,
  ClipboardCheck,
  CornerDownLeft,
  FileStack,
  Inbox,
  MessageSquareText,
  RefreshCw,
  Reply,
} from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/shared/EmptyState';
import { notificationsApi, NotificationItem } from '@/lib/api/notifications';
import { cn, formatDateTime, formatRelative } from '@/lib/utils';

const notificationTypeMeta: Record<
  string,
  { label: string; icon: any; accent: string }
> = {
  ASSIGNMENT_CHANGED: {
    label: 'Назначение',
    icon: ClipboardCheck,
    accent: 'text-blue-700 bg-blue-50 border-blue-100',
  },
  STATUS_CHANGED: {
    label: 'Статус',
    icon: RefreshCw,
    accent: 'text-slate-700 bg-slate-50 border-slate-200',
  },
  CARD_UPDATED: {
    label: 'Карточка',
    icon: RefreshCw,
    accent: 'text-cyan-700 bg-cyan-50 border-cyan-100',
  },
  REVIEW_REQUEST: {
    label: 'Проверка',
    icon: BellRing,
    accent: 'text-violet-700 bg-violet-50 border-violet-100',
  },
  COMMENT_ADDED: {
    label: 'Комментарий',
    icon: MessageSquareText,
    accent: 'text-amber-700 bg-amber-50 border-amber-100',
  },
  SOURCE_MATERIAL_ADDED: {
    label: 'Исходные данные',
    icon: FileStack,
    accent: 'text-emerald-700 bg-emerald-50 border-emerald-100',
  },
  RESULT_ADDED: {
    label: 'Результат',
    icon: CheckCircle2,
    accent: 'text-sky-700 bg-sky-50 border-sky-100',
  },
  ADMIN_REQUEST_CREATED: {
    label: 'Обращение',
    icon: Inbox,
    accent: 'text-fuchsia-700 bg-fuchsia-50 border-fuchsia-100',
  },
  ADMIN_REQUEST_NEEDS_INFO: {
    label: 'Уточнение',
    icon: CornerDownLeft,
    accent: 'text-blue-700 bg-blue-50 border-blue-100',
  },
  ADMIN_REQUEST_REPLIED: {
    label: 'Уточнение',
    icon: Reply,
    accent: 'text-indigo-700 bg-indigo-50 border-indigo-100',
  },
  ADMIN_REQUEST_COMPLETED: {
    label: 'Обращение',
    icon: CheckCircle2,
    accent: 'text-emerald-700 bg-emerald-50 border-emerald-100',
  },
  ADMIN_REQUEST_REJECTED: {
    label: 'Обращение',
    icon: Ban,
    accent: 'text-rose-700 bg-rose-50 border-rose-100',
  },
};

function NotificationRow({
  notification,
  onOpenItem,
  onMarkRead,
  compact = false,
}: {
  notification: NotificationItem;
  onOpenItem: (notification: NotificationItem) => void;
  onMarkRead: (id: string) => void;
  compact?: boolean;
}) {
  const meta = notificationTypeMeta[notification.type] || notificationTypeMeta.STATUS_CHANGED;
  const Icon = meta.icon;
  const cardName = notification.card
    ? notification.card.dataSource?.name
      ? notification.card.extraTitle
        ? `${notification.card.dataSource.name} — ${notification.card.extraTitle}`
        : notification.card.dataSource.name
      : notification.card.extraTitle || notification.card.publicId
    : null;
  const requestName = notification.adminRequest
    ? notification.adminRequest.description.length > 120
      ? `${notification.adminRequest.description.slice(0, 117)}...`
      : notification.adminRequest.description
    : null;
  const adminRequestStatusLabel =
    notification.adminRequest?.status === 'DONE'
      ? 'Выполнено'
      : notification.adminRequest?.status === 'CLARIFICATION_REQUIRED'
      ? 'На уточнении'
      : notification.adminRequest?.status === 'REJECTED'
      ? 'Отклонено'
      : 'Новое';

  return (
    <div
      className={cn(
        'rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900/70',
        compact ? 'p-4' : 'p-5',
        notification.isRead ? 'border-slate-200 dark:border-slate-700' : 'border-blue-200 ring-1 ring-blue-100 dark:border-blue-500/40 dark:ring-blue-500/20',
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold', meta.accent)}>
              <Icon className="h-3.5 w-3.5" />
              {meta.label}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
                notification.isRead
                  ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  : 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300',
              )}
            >
              {notification.isRead ? 'Прочитано' : 'Новое'}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">{formatRelative(notification.createdAt)}</span>
          </div>

          <h2 className={cn('mt-3 font-semibold text-slate-900 dark:text-slate-100', compact ? 'text-sm' : 'text-base')}>
            {notification.title}
          </h2>
          <p className={cn('mt-1 text-slate-600 dark:text-slate-300', compact ? 'text-sm leading-5' : 'text-sm leading-6')}>
            {notification.message}
          </p>

          {notification.card && (
            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
              <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                <span>{notification.card.publicId}</span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="truncate">{cardName}</span>
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Спринт: {notification.card.sprint?.name || 'Не назначен'}
                {notification.actor?.fullName ? ` • Изменение: ${notification.actor.fullName}` : ''}
                {' • '}
                {formatDateTime(notification.createdAt)}
              </div>
            </div>
          )}

          {notification.adminRequest && (
            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
              <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                <span>{notification.adminRequest.publicId}</span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="truncate">{requestName}</span>
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Статус: {adminRequestStatusLabel}
                {notification.adminRequest.createdBy?.fullName ? ` • Автор: ${notification.adminRequest.createdBy.fullName}` : ''}
                {notification.actor?.fullName ? ` • Изменение: ${notification.actor.fullName}` : ''}
                {' • '}
                {formatDateTime(notification.createdAt)}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {!notification.isRead && (
            <button
              type="button"
              onClick={() => onMarkRead(notification.id)}
              className="btn-secondary"
            >
              Отметить прочитанным
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenItem(notification)}
            className="btn-primary"
          >
            {notification.adminRequest ? 'Открыть обращение' : 'Открыть карточку'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function NotificationsCenterContent({
  compact = false,
  onNavigate,
}: {
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);

  const notificationsQuery = useQuery({
    queryKey: ['notifications', unreadOnly, compact ? 'modal' : 'page'],
    queryFn: () => notificationsApi.getAll({ unreadOnly, limit: compact ? 20 : 50 }),
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      toast.success(res.updated > 0 ? 'Все уведомления отмечены как прочитанные' : 'Новых уведомлений нет');
    },
    onError: () => {
      toast.error('Не удалось обновить уведомления');
    },
  });

  const handleOpenItem = async (notification: NotificationItem) => {
    if (!notification.isRead) {
      await markAsReadMutation.mutateAsync(notification.id);
    }

    onNavigate?.();

    if (notification.card?.publicId) {
      router.push(`/cards/${notification.card.publicId}`);
      return;
    }

    if (notification.adminRequest?.publicId) {
      router.push(`/requests?focus=${notification.adminRequest.publicId}`);
    }
  };

  const items = notificationsQuery.data?.items || [];
  const unreadCount = notificationsQuery.data?.unreadCount || 0;
  const total = notificationsQuery.data?.total ?? 0;

  return (
    <div className={compact ? 'space-y-4' : 'space-y-6'}>
      <div
        className={cn(
          compact &&
            'sticky top-0 z-20 -mx-6 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4 shadow-[0_12px_20px_-18px_rgba(15,23,42,0.28)] dark:shadow-[0_12px_24px_-18px_rgba(0,0,0,0.55)]',
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setUnreadOnly((prev) => !prev)}
              className={cn('toolbar-button toolbar-button-secondary', unreadOnly && 'toolbar-button-active')}
            >
              {unreadOnly ? 'Показать все' : 'Только новые'}
            </button>
            <button
              type="button"
              onClick={() => markAllAsReadMutation.mutate()}
              className="toolbar-button toolbar-button-primary"
              disabled={markAllAsReadMutation.isPending}
            >
              <CheckCheck className="h-4 w-4" />
              Прочитать всё
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
              Всего: {total}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
              Новых: {unreadCount}
            </span>
          </div>
        </div>
      </div>

      {notificationsQuery.isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: compact ? 3 : 4 }).map((_, index) => (
            <div key={index} className={cn('skeleton rounded-2xl', compact ? 'h-32' : 'h-36')} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={unreadOnly ? 'Новых уведомлений нет' : 'Уведомлений пока нет'}
          description={
            unreadOnly
              ? 'Все уведомления уже прочитаны. Можно переключиться на полный список.'
              : 'Когда по подписанным карточкам появятся изменения, они отобразятся здесь.'
          }
        />
      ) : (
        <div className={cn('space-y-4', compact && 'pr-1')}>
          {items.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              onOpenItem={handleOpenItem}
              onMarkRead={(id) => markAsReadMutation.mutate(id)}
              compact={compact}
            />
          ))}
        </div>
      )}
    </div>
  );
}
