'use client';

import { Suspense, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2,
  ExternalLink,
  Inbox,
  Link2,
  Plus,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/shared/EmptyState';
import { adminRequestsApi, AdminRequestItem } from '@/lib/api/adminRequests';
import { useAuthStore } from '@/lib/store/auth.store';
import { cn, formatDateTime, formatRelative } from '@/lib/utils';
import { toast } from 'sonner';

function RequestStatusBadge({ status }: { status: AdminRequestItem['status'] }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold',
        status === 'DONE'
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-amber-50 text-amber-700',
      )}
    >
      {status === 'DONE' ? 'Выполнено' : 'Новое'}
    </span>
  );
}

function RequestCard({
  request,
  isAdmin,
  isFocused,
  completionComment,
  onCompletionCommentChange,
  onComplete,
  isCompleting,
}: {
  request: AdminRequestItem;
  isAdmin: boolean;
  isFocused: boolean;
  completionComment: string;
  onCompletionCommentChange: (value: string) => void;
  onComplete: () => void;
  isCompleting: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border bg-white p-5 shadow-sm transition',
        isFocused ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200',
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {request.publicId}
            </span>
            <RequestStatusBadge status={request.status} />
            <span className="text-xs text-slate-400">{formatRelative(request.createdAt)}</span>
          </div>

          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {request.description}
          </p>

          {request.links.length > 0 && (
            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
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

          <div className="mt-4 text-xs text-slate-500">
            <span>Создано: {request.createdBy.fullName}</span>
            <span> • {formatDateTime(request.createdAt)}</span>
            {request.completedBy?.fullName && request.completedAt && (
              <>
                <span> • Выполнил: {request.completedBy.fullName}</span>
                <span> • {formatDateTime(request.completedAt)}</span>
              </>
            )}
          </div>

          {request.completionComment && (
            <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <div className="font-medium">Комментарий администратора</div>
              <div className="mt-1 whitespace-pre-wrap">{request.completionComment}</div>
            </div>
          )}
        </div>

        {isAdmin && request.status === 'NEW' && (
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-800">Обработать обращение</div>
            <textarea
              value={completionComment}
              onChange={(event) => onCompletionCommentChange(event.target.value)}
              rows={4}
              className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
              placeholder="Необязательный комментарий для пользователя"
            />
            <button
              type="button"
              onClick={onComplete}
              disabled={isCompleting}
              className="btn-primary mt-3 w-full justify-center"
            >
              <CheckCircle2 className="h-4 w-4" />
              Отметить выполненным
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RequestsPageContent() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const focusId = searchParams.get('focus') || '';

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NEW' | 'DONE'>('ALL');
  const [description, setDescription] = useState('');
  const [links, setLinks] = useState<string[]>(['']);
  const [completionComments, setCompletionComments] = useState<Record<string, string>>({});

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

  const items = requestsQuery.data?.items || [];
  const stats = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        if (item.status === 'DONE') acc.done += 1;
        else acc.new += 1;
        return acc;
      },
      { new: 0, done: 0 },
    );
  }, [items]);

  const canSubmit = description.trim().length >= 10;

  return (
    <AppLayout>
      <div className="page-container-wide">
        <div className="page-header">
          <div>
            <h1 className="section-title">
              {isAdmin ? 'Входящие обращения' : 'Обращения к администратору'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {isAdmin
                ? 'Все новые запросы от пользователей и руководителей.'
                : 'Опишите действие, которое должен выполнить администратор, и при необходимости приложите ссылки.'}
            </p>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Всего</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{requestsQuery.data?.total ?? 0}</div>
            <div className="mt-1 text-sm text-slate-500">
              {isAdmin ? 'обращений в текущей выборке' : 'ваших обращений'}
            </div>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-600">Новые</div>
            <div className="mt-2 text-3xl font-semibold text-amber-800">{stats.new}</div>
            <div className="mt-1 text-sm text-amber-700">
              {isAdmin ? 'ожидают обработки' : 'ещё не выполнены'}
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">Выполнено</div>
            <div className="mt-2 text-3xl font-semibold text-emerald-800">{stats.done}</div>
            <div className="mt-1 text-sm text-emerald-700">уже закрыто</div>
          </div>
        </div>

        {!isAdmin && (
          <div className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Новое обращение</h2>
                <p className="text-sm text-slate-500">
                  Администратор получит уведомление сразу после отправки.
                </p>
              </div>
            </div>

            <div className="mt-5">
              <label className="text-sm font-medium text-slate-700">Описание</label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={6}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
                placeholder="Например: нужно обновить права доступа, проверить работу интеграции, помочь с загрузкой файлов..."
              />
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">Ссылки</label>
                <button
                  type="button"
                  onClick={() => setLinks((prev) => [...prev, ''])}
                  className="btn-secondary"
                >
                  <Plus className="h-4 w-4" />
                  Добавить ссылку
                </button>
              </div>
              <div className="mt-3 space-y-3">
                {links.map((link, index) => (
                  <div key={index} className="flex gap-3">
                    <input
                      value={link}
                      onChange={(event) =>
                        setLinks((prev) => prev.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))
                      }
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
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

            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                После обработки обращение автоматически перейдёт в статус `Выполнено`.
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
          {(['ALL', 'NEW', 'DONE'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition',
                statusFilter === status
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100',
              )}
            >
              {status === 'ALL' ? 'Все' : status === 'NEW' ? 'Новые' : 'Выполненные'}
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
              <RequestCard
                key={request.id}
                request={request}
                isAdmin={!!isAdmin}
                isFocused={focusId === request.publicId}
                completionComment={completionComments[request.id] || ''}
                onCompletionCommentChange={(value) =>
                  setCompletionComments((prev) => ({ ...prev, [request.id]: value }))
                }
                onComplete={() =>
                  completeMutation.mutate({
                    id: request.id,
                    completionComment: completionComments[request.id] || undefined,
                  })
                }
                isCompleting={completeMutation.isPending}
              />
            ))}
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
