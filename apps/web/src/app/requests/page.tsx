'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Ban,
  CheckCircle2,
  CornerDownLeft,
  ExternalLink,
  Inbox,
  Link2,
  Plus,
  Reply,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/shared/EmptyState';
import { adminRequestsApi, AdminRequestItem } from '@/lib/api/adminRequests';
import { useAuthStore } from '@/lib/store/auth.store';
import { cn, formatDateTime, formatRelative } from '@/lib/utils';
import { toast } from 'sonner';

function RequestStatusBadge({ status }: { status: AdminRequestItem['status'] }) {
  const variants = {
    NEW: 'bg-amber-50 text-amber-700',
    CLARIFICATION_REQUIRED: 'bg-blue-50 text-blue-700',
    DONE: 'bg-emerald-50 text-emerald-700',
    REJECTED: 'bg-rose-50 text-rose-700',
  } as const;

  const labels = {
    NEW: 'Новое',
    CLARIFICATION_REQUIRED: 'На уточнении',
    DONE: 'Выполнено',
    REJECTED: 'Отклонено',
  } as const;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold',
        variants[status],
      )}
    >
      {labels[status]}
    </span>
  );
}

function RequestCard({
  request,
  isAdmin,
  isFocused,
  isEmbedded = false,
  actionComment,
  replyComment,
  onActionCommentChange,
  onReplyCommentChange,
  onComplete,
  onRequestClarification,
  onReject,
  onReply,
  isProcessing,
}: {
  request: AdminRequestItem;
  isAdmin: boolean;
  isFocused: boolean;
  isEmbedded?: boolean;
  actionComment: string;
  replyComment: string;
  onActionCommentChange: (value: string) => void;
  onReplyCommentChange: (value: string) => void;
  onComplete: () => void;
  onRequestClarification: () => void;
  onReject: () => void;
  onReply: () => void;
  isProcessing: boolean;
}) {
  return (
    <div
      className={cn(
        'request-card transition',
        isEmbedded ? 'request-card-embedded' : '',
        isFocused ? 'request-card-active' : '',
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="request-id-chip">
              {request.publicId}
            </span>
            <RequestStatusBadge status={request.status} />
            <span className="request-meta-text">{formatRelative(request.createdAt)}</span>
          </div>

          <p className="request-body-text mt-3 whitespace-pre-wrap text-sm leading-6">
            {request.description}
          </p>

          {request.links.length > 0 && (
            <div className="request-subpanel mt-3 px-4 py-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium request-title-text">
                <Link2 className="h-4 w-4" />
                Приложенные ссылки
              </div>
              <div className="flex flex-col gap-2">
                {request.links.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 break-all text-sm text-blue-600 hover:text-blue-700"
                  >
                    <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{link.url}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="request-meta-text mt-3 text-xs">
            <span>Создано: {request.createdBy.fullName}</span>
            <span> • {formatDateTime(request.createdAt)}</span>
            {request.completedBy?.fullName && request.completedAt && (
              <>
                <span> • Выполнил: {request.completedBy.fullName}</span>
                <span> • {formatDateTime(request.completedAt)}</span>
              </>
            )}
            {request.rejectedBy?.fullName && request.rejectedAt && (
              <>
                <span> • Отклонил: {request.rejectedBy.fullName}</span>
                <span> • {formatDateTime(request.rejectedAt)}</span>
              </>
            )}
          </div>

          {request.completionComment && (
            <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <div className="font-medium">Комментарий администратора</div>
              <div className="mt-1 whitespace-pre-wrap">{request.completionComment}</div>
            </div>
          )}

          {request.rejectionComment && (
            <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <div className="font-medium">Причина отклонения</div>
              <div className="mt-1 whitespace-pre-wrap">{request.rejectionComment}</div>
            </div>
          )}

          {request.status === 'CLARIFICATION_REQUIRED' && !isAdmin && (
            <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              Администратор запросил уточнение по этому обращению. Ответь ниже, и обращение снова вернётся администратору.
            </div>
          )}

          {request.messages.length > 0 && (
            <div className="request-subpanel mt-3 px-4 py-4">
              <div className="text-sm font-semibold request-title-text">Переписка</div>
              <div className="mt-3 space-y-3">
                {request.messages.map((message) => (
                  <div key={message.id} className="request-message-card px-4 py-3">
                    <div className="request-meta-text flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-medium request-title-text">{message.author.fullName}</span>
                      <span>•</span>
                      <span>{formatDateTime(message.createdAt)}</span>
                    </div>
                    <div className="request-body-text mt-2 whitespace-pre-wrap text-sm leading-6">
                      {message.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {isAdmin && request.status !== 'DONE' && request.status !== 'REJECTED' && (
          <div className="request-side-panel w-full max-w-sm p-4">
            <div className="text-sm font-semibold request-title-text">Обработать обращение</div>
            <textarea
              value={actionComment}
              onChange={(event) => onActionCommentChange(event.target.value)}
              rows={4}
              className="input mt-3 w-full rounded-xl px-3 py-2 text-sm"
              placeholder={
                request.status === 'CLARIFICATION_REQUIRED'
                  ? 'Комментарий администратора (для выполнения или отклонения)'
                  : 'Комментарий администратора'
              }
            />
            <div className="mt-3 grid gap-2">
              {request.status === 'NEW' && (
                <button
                  type="button"
                  onClick={onRequestClarification}
                  disabled={isProcessing || actionComment.trim().length < 3}
                  className="btn-secondary w-full justify-center"
                >
                  <CornerDownLeft className="h-4 w-4" />
                  Вернуть на уточнение
                </button>
              )}
              <button
                type="button"
                onClick={onComplete}
                disabled={isProcessing}
                className="btn-primary w-full justify-center"
              >
                <CheckCircle2 className="h-4 w-4" />
                Отметить выполненным
              </button>
              <button
                type="button"
                onClick={onReject}
                disabled={isProcessing}
                className="btn-danger w-full justify-center"
              >
                <Ban className="h-4 w-4" />
                Отклонить
              </button>
            </div>
          </div>
        )}

        {!isAdmin && request.status === 'CLARIFICATION_REQUIRED' && (
          <div className="request-side-panel w-full max-w-sm p-4">
            <div className="text-sm font-semibold request-title-text">Ответить администратору</div>
            <textarea
              value={replyComment}
              onChange={(event) => onReplyCommentChange(event.target.value)}
              rows={4}
              className="input mt-3 w-full rounded-xl px-3 py-2 text-sm"
              placeholder="Добавьте уточнение или дополнительный комментарий"
            />
            <button
              type="button"
              onClick={onReply}
              disabled={isProcessing || replyComment.trim().length < 3}
              className="btn-primary mt-3 w-full justify-center"
            >
              <Reply className="h-4 w-4" />
              Вернуть администратору
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RequestListItem({
  request,
  isActive,
  onOpen,
}: {
  request: AdminRequestItem;
  isActive: boolean;
  onOpen: () => void;
}) {
  const lastMessage = request.messages[request.messages.length - 1];

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'request-list-item w-full p-4 text-left transition',
        isActive
          ? 'request-list-item-active'
          : 'request-list-item-idle',
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="request-id-chip">
              {request.publicId}
            </span>
            <RequestStatusBadge status={request.status} />
            <span className="request-meta-text">{formatRelative(request.updatedAt)}</span>
          </div>
          <div className="request-title-text mt-3 text-sm font-medium">
            {request.createdBy.fullName}
          </div>
          <p className="request-body-text mt-2 line-clamp-2 text-sm leading-6">
            {request.description}
          </p>
          {lastMessage && (
            <div className="request-meta-text mt-2 text-xs">
              Последнее сообщение: {lastMessage.author.fullName} • {formatRelative(lastMessage.createdAt)}
            </div>
          )}
        </div>

        <div className="request-meta-text flex shrink-0 flex-col items-start gap-1 text-xs md:items-end">
          <span>Создано {formatDateTime(request.createdAt)}</span>
          <span>Обновлено {formatDateTime(request.updatedAt)}</span>
        </div>
      </div>
    </button>
  );
}

function RequestsPageContent() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const focusId = searchParams.get('focus') || '';

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NEW' | 'CLARIFICATION_REQUIRED' | 'DONE' | 'REJECTED'>('ALL');
  const [description, setDescription] = useState('');
  const [links, setLinks] = useState<string[]>(['']);
  const [actionComments, setActionComments] = useState<Record<string, string>>({});
  const [replyComments, setReplyComments] = useState<Record<string, string>>({});
  const [selectedRequestId, setSelectedRequestId] = useState<string>('');
  const [hasInitializedSelection, setHasInitializedSelection] = useState(false);

  const requestsQuery = useQuery({
    queryKey: ['admin-requests', statusFilter, isAdmin],
    queryFn: () =>
      adminRequestsApi.getAll({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        limit: 100,
      }),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      adminRequestsApi.create({
        description,
        links: links.map((link) => link.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-requests'] });
      setDescription('');
      setLinks(['']);
      toast.success('Обращение отправлено администратору');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Не удалось отправить обращение');
    },
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, completionComment }: { id: string; completionComment?: string }) =>
      adminRequestsApi.complete(id, { completionComment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-requests'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      toast.success('Обращение отмечено как выполненное');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Не удалось обработать обращение');
    },
  });

  const clarificationMutation = useMutation({
    mutationFn: ({ id, clarificationComment }: { id: string; clarificationComment: string }) =>
      adminRequestsApi.requestClarification(id, { clarificationComment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-requests'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      toast.success('Обращение возвращено на уточнение');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Не удалось вернуть обращение на уточнение');
    },
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => adminRequestsApi.reply(id, { text }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-requests'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      toast.success('Уточнение отправлено администратору');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Не удалось отправить уточнение');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, rejectionComment }: { id: string; rejectionComment?: string }) =>
      adminRequestsApi.reject(id, { rejectionComment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-requests'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      toast.success('Обращение отклонено');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Не удалось отклонить обращение');
    },
  });

  const items = requestsQuery.data?.items || [];
  const selectedRequest = items.find((item) => item.id === selectedRequestId) || items.find((item) => item.publicId === selectedRequestId) || null;
  const stats = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        if (item.status === 'DONE') acc.done += 1;
        else if (item.status === 'CLARIFICATION_REQUIRED') acc.clarification += 1;
        else if (item.status === 'REJECTED') acc.rejected += 1;
        else acc.new += 1;
        return acc;
      },
      { new: 0, clarification: 0, done: 0, rejected: 0 },
    );
  }, [items]);

  const canSubmit = description.trim().length >= 3;

  useEffect(() => {
    if (hasInitializedSelection) {
      return;
    }

    if (!focusId) {
      setHasInitializedSelection(true);
      return;
    }

    if (focusId) {
      const focusedRequest = items.find((item) => item.publicId === focusId || item.id === focusId);
      if (focusedRequest) {
        setSelectedRequestId(focusedRequest.id);
        setHasInitializedSelection(true);
        return;
      }
    }
  }, [focusId, hasInitializedSelection, items]);

  return (
    <AppLayout>
      <div className="page-container-wide">
        <div className="page-hero">
          <div className="page-hero-body">
            <div className="page-title-row">
              <div className="flex-1 min-w-0">
                <div className="page-kicker">Коммуникации</div>
                <h1 className="mt-4 text-2xl font-semibold">
                  {isAdmin ? 'Входящие обращения' : 'Обращения к администратору'}
                </h1>
                <p className="page-subtitle">
                  {isAdmin
                    ? 'Все новые запросы от пользователей и руководителей с возможностью быстро вернуть на уточнение, выполнить или отклонить.'
                    : 'Опишите действие, которое должен выполнить администратор, и при необходимости приложите ссылки.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4 overflow-x-auto">
          <div className="request-stats-strip flex min-w-max items-stretch gap-2 p-2">
            <div className="request-stat-card min-w-[120px] px-3 py-2">
              <div className="request-stat-label text-[11px] font-semibold uppercase tracking-[0.14em]">Всего</div>
              <div className="request-stat-value mt-1 text-xl font-semibold">{requestsQuery.data?.total ?? 0}</div>
            </div>
            <div className="request-stat-card request-stat-card-new min-w-[120px] px-3 py-2">
              <div className="request-stat-label request-stat-label-new text-[11px] font-semibold uppercase tracking-[0.14em]">Новые</div>
              <div className="mt-1 text-xl font-semibold text-amber-800">{stats.new}</div>
            </div>
            <div className="request-stat-card request-stat-card-clarification min-w-[140px] px-3 py-2">
              <div className="request-stat-label request-stat-label-clarification text-[11px] font-semibold uppercase tracking-[0.14em]">На уточнении</div>
              <div className="mt-1 text-xl font-semibold text-blue-800">{stats.clarification}</div>
            </div>
            <div className="request-stat-card request-stat-card-done min-w-[130px] px-3 py-2">
              <div className="request-stat-label request-stat-label-done text-[11px] font-semibold uppercase tracking-[0.14em]">Выполнено</div>
              <div className="mt-1 text-xl font-semibold text-emerald-800">{stats.done}</div>
            </div>
            <div className="request-stat-card request-stat-card-rejected min-w-[130px] px-3 py-2">
              <div className="request-stat-label request-stat-label-rejected text-[11px] font-semibold uppercase tracking-[0.14em]">Отклонено</div>
              <div className="mt-1 text-xl font-semibold text-rose-800">{stats.rejected}</div>
            </div>
          </div>
        </div>

        {!isAdmin && (
          <div className="request-create-panel mb-6 p-5">
            <div className="flex items-center gap-3">
              <div className="request-icon-shell flex h-10 w-10 items-center justify-center rounded-2xl">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="request-title-text text-base font-semibold">Новое обращение</h2>
                <p className="request-meta-text text-xs">
                  Администратор получит уведомление сразу после отправки.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label className="request-title-text text-sm font-medium">Описание</label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={5}
                className="input mt-2 w-full rounded-2xl px-4 py-3 text-sm"
                placeholder="Например: нужно обновить права доступа, проверить работу интеграции, помочь с загрузкой файлов..."
              />
              <div className="request-meta-text mt-1 text-xs">
                Минимум 3 символа.
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <label className="request-title-text text-sm font-medium">Ссылки</label>
                <button
                  type="button"
                  onClick={() => setLinks((prev) => [...prev, ''])}
                  className="btn-secondary"
                >
                  <Plus className="h-4 w-4" />
                  Добавить ссылку
                </button>
              </div>
              <div className="mt-3 space-y-2.5">
                {links.map((link, index) => (
                  <div key={index} className="flex gap-3">
                    <input
                      value={link}
                      onChange={(event) =>
                        setLinks((prev) => prev.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))
                      }
                      className="input flex-1 rounded-xl px-4 py-2.5 text-sm"
                      placeholder="https://..."
                    />
                    {links.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setLinks((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                        className="btn-secondary"
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-4">
              <p className="request-meta-text text-xs">
                Администратор сможет выполнить обращение, вернуть его на уточнение или отклонить.
              </p>
              <button
                type="button"
                onClick={() => createMutation.mutate()}
                disabled={!canSubmit || createMutation.isPending}
                className="btn-primary"
              >
                <Send className="h-4 w-4" />
                Отправить обращение
              </button>
            </div>
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {(['ALL', 'NEW', 'CLARIFICATION_REQUIRED', 'DONE', 'REJECTED'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition',
                statusFilter === status
                  ? 'request-filter-tab request-filter-tab-active'
                  : 'request-filter-tab request-filter-tab-idle',
              )}
            >
              {status === 'ALL'
                ? 'Все'
                : status === 'NEW'
                ? 'Новые'
                : status === 'CLARIFICATION_REQUIRED'
                ? 'На уточнении'
                : status === 'DONE'
                ? 'Выполненные'
                : 'Отклонённые'}
            </button>
          ))}
        </div>

        {requestsQuery.isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="skeleton h-44 rounded-2xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={isAdmin ? 'Новых обращений нет' : 'Обращения пока не отправлялись'}
            description={
              isAdmin
                ? 'Когда пользователи отправят новые обращения, они появятся здесь.'
                : 'Вы можете создать первое обращение к администратору прямо на этой странице.'
            }
            action={
              isAdmin ? undefined : (
                <Link href="/dashboard" className="btn-secondary">
                  Вернуться в кабинет
                </Link>
              )
            }
          />
        ) : (
          <div className="space-y-4">
            {items.map((request) => (
              <RequestListItem
                key={request.id}
                request={request}
                isActive={selectedRequestId === request.id}
                onOpen={() => setSelectedRequestId(request.id)}
              />
            ))}
          </div>
        )}

        {selectedRequest && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm"
            onClick={() => setSelectedRequestId('')}
          >
            <div
              className="request-modal-shell w-full max-w-5xl overflow-hidden"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="request-modal-header flex items-center justify-between px-6 py-4">
                <div>
                  <div className="request-meta-text text-xs font-semibold uppercase tracking-[0.16em]">Просмотр обращения</div>
                  <div className="request-title-text mt-1 text-lg font-semibold">{selectedRequest.publicId}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRequestId('')}
                  className="btn-icon h-10 w-10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[calc(100vh-140px)] overflow-y-auto p-6">
                <RequestCard
                  request={selectedRequest}
                  isAdmin={!!isAdmin}
                  isFocused={false}
                  isEmbedded
                  actionComment={actionComments[selectedRequest.id] || ''}
                  replyComment={replyComments[selectedRequest.id] || ''}
                  onActionCommentChange={(value) =>
                    setActionComments((prev) => ({ ...prev, [selectedRequest.id]: value }))
                  }
                  onReplyCommentChange={(value) =>
                    setReplyComments((prev) => ({ ...prev, [selectedRequest.id]: value }))
                  }
                  onComplete={() =>
                    completeMutation.mutate({
                      id: selectedRequest.id,
                      completionComment: actionComments[selectedRequest.id] || undefined,
                    })
                  }
                  onRequestClarification={() =>
                    clarificationMutation.mutate({
                      id: selectedRequest.id,
                      clarificationComment: actionComments[selectedRequest.id] || '',
                    })
                  }
                  onReject={() =>
                    rejectMutation.mutate({
                      id: selectedRequest.id,
                      rejectionComment: actionComments[selectedRequest.id] || undefined,
                    })
                  }
                  onReply={() =>
                    replyMutation.mutate({
                      id: selectedRequest.id,
                      text: replyComments[selectedRequest.id] || '',
                    })
                  }
                  isProcessing={
                    completeMutation.isPending ||
                    clarificationMutation.isPending ||
                    rejectMutation.isPending ||
                    replyMutation.isPending
                  }
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function RequestsPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="page-container-wide">
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="skeleton h-40 rounded-2xl" />
              ))}
            </div>
          </div>
        </AppLayout>
      }
    >
      <RequestsPageContent />
    </Suspense>
  );
}
