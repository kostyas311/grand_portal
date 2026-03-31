'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Bell,
  BellRing,
  CheckCheck,
  CheckCircle2,
  ClipboardCheck,
  FileStack,
  Inbox,
  MessageSquareText,
  RefreshCw,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/shared/EmptyState';
import { notificationsApi, NotificationItem } from '@/lib/api/notifications';
import { formatDateTime, formatRelative, getMonthName } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
  ADMIN_REQUEST_COMPLETED: {
    label: 'Обращение',
    icon: CheckCircle2,
    accent: 'text-emerald-700 bg-emerald-50 border-emerald-100',
  },
};

function NotificationRow({
  notification,
  onOpenCard,
  onMarkRead,
}: {
  notification: NotificationItem;
  onOpenCard: (notification: NotificationItem) => void;
  onMarkRead: (id: string) => void;
}) {
  const meta = notificationTypeMeta[notification.type] || notificationTypeMeta.STATUS_CHANGED;
  const Icon = meta.icon;
  const cardName = notification.card
    ? notification.card.extraTitle ||
      notification.card.dataSource?.name ||
      notification.card.publicId
    : null;
  const requestName = notification.adminRequest
    ? notification.adminRequest.description.length > 120
      ? `${notification.adminRequest.description.slice(0, 117)}...`
      : notification.adminRequest.description
    : null;

  return (
    <div
      className={cn(
        'rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
        notification.isRead ? 'border-slate-200' : 'border-blue-200 ring-1 ring-blue-100',
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
                  ? 'bg-slate-100 text-slate-600'
                  : 'bg-red-50 text-red-600',
              )}
            >
              {notification.isRead ? 'Прочитано' : 'Новое'}
            </span>
            <span className="text-xs text-slate-400">{formatRelative(notification.createdAt)}</span>
          </div>

          <h2 className="mt-3 text-base font-semibold text-slate-900">{notification.title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{notification.message}</p>

          {notification.card && (
            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800">
                <span>{notification.card.publicId}</span>
                <span className="text-slate-300">•</span>
                <span className="truncate">{cardName}</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Период: {getMonthName(notification.card.month)} {notification.card.year}
                {notification.actor?.fullName ? ` • Изменение: ${notification.actor.fullName}` : ''}
                {' • '}
                {formatDateTime(notification.createdAt)}
              </div>
            </div>
          )}

          {notification.adminRequest && (
            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800">
                <span>{notification.adminRequest.publicId}</span>
                <span className="text-slate-300">•</span>
                <span className="truncate">{requestName}</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Статус: {notification.adminRequest.status === 'DONE' ? 'Выполнено' : 'Новое'}
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
            onClick={() => onOpenCard(notification)}
            className="btn-primary"
          >
            {notification.adminRequest ? 'Открыть обращение' : 'Открыть карточку'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);

  const notificationsQuery = useQuery({
    queryKey: ['notifications', unreadOnly],
    queryFn: () => notificationsApi.getAll({ unreadOnly, limit: 50 }),
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

  const handleOpenCard = async (notification: NotificationItem) => {
    if (!notification.isRead) {
      await markAsReadMutation.mutateAsync(notification.id);
    }
    if (notification.card?.publicId) {
      router.push(`/cards/${notification.card.publicId}`);
      return;
    }

    if (notification.adminRequest?.publicId) {
      router.push(`/requests?focus=${notification.adminRequest.publicId}`);
    }
  };

  const handleMarkRead = (id: string) => {
    markAsReadMutation.mutate(id);
  };

  const items = notificationsQuery.data?.items || [];
  const unreadCount = notificationsQuery.data?.unreadCount || 0;

  return (
    <AppLayout>
      <div className="page-container-wide">
        <div className="page-header">
          <div>
            <h1 className="section-title">Центр уведомлений</h1>
            <p className="mt-1 text-sm text-slate-500">
              Все изменения по карточкам и обращениям, которые требуют вашего внимания, в одном месте.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setUnreadOnly((prev) => !prev)}
              className={cn('btn-secondary', unreadOnly && 'border-blue-200 bg-blue-50 text-blue-700')}
            >
              {unreadOnly ? 'Показать все' : 'Только новые'}
            </button>
            <button
              type="button"
              onClick={() => markAllAsReadMutation.mutate()}
              className="btn-primary"
              disabled={markAllAsReadMutation.isPending}
            >
              <CheckCheck className="h-4 w-4" />
              Прочитать всё
            </button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Всего</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{notificationsQuery.data?.total ?? 0}</div>
            <div className="mt-1 text-sm text-slate-500">уведомлений в текущей выборке</div>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-500">Непрочитанные</div>
            <div className="mt-2 text-3xl font-semibold text-blue-800">{unreadCount}</div>
            <div className="mt-1 text-sm text-blue-600">требуют внимания</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Режим</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">
              {unreadOnly ? 'Только новые' : 'Все уведомления'}
            </div>
            <div className="mt-1 text-sm text-slate-500">можно переключить в один клик</div>
          </div>
        </div>

        {notificationsQuery.isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="skeleton h-36 rounded-2xl" />
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
          <div className="space-y-4">
            {items.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onOpenCard={handleOpenCard}
                onMarkRead={handleMarkRead}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
