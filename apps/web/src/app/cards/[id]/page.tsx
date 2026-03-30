'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowLeft, Edit, Trash2, Lock, User, Calendar,
  Paperclip, FileText, MessageSquare,
  Download, Plus, Link as LinkIcon, ExternalLink, Copy, Check, X, Bell, BellOff, GitBranch,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { CardStatusBadge } from '@/components/cards/CardStatusBadge';
import { CardPriorityBadge } from '@/components/cards/CardPriorityBadge';
import { CopyLink } from '@/components/shared/CopyLink';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ExternalUrlLink } from '@/components/shared/ExternalUrlLink';
import { isLocalPath } from '@/lib/utils';
import { cardsApi, materialsApi, resultsApi, commentsApi, usersApi } from '@/lib/api';
import {
  formatDate, formatRelative, formatFileSize,
  getMonthName,
} from '@/lib/utils';
import { useAuthStore } from '@/lib/store/auth.store';

export default function CardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [copiedUrlId, setCopiedUrlId] = useState<string | null>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [statusComment, setStatusComment] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showUploadMaterial, setShowUploadMaterial] = useState(false);
  const [showUploadResult, setShowUploadResult] = useState(false);
  const [newComment, setNewComment] = useState('');

  // Upload material state
  const [matType, setMatType] = useState<'FILE' | 'EXTERNAL_LINK'>('FILE');
  const [matTitle, setMatTitle] = useState('');
  const [matDescription, setMatDescription] = useState('');
  const [matUrl, setMatUrl] = useState('');
  const [matFiles, setMatFiles] = useState<FileList | null>(null);
  const [matUploading, setMatUploading] = useState(false);

  // Upload result state
  const [resFiles, setResFiles] = useState<FileList | null>(null);
  const [resComment, setResComment] = useState('');
  const [resUploading, setResUploading] = useState(false);
  const [resLinks, setResLinks] = useState<{url: string; title: string; description: string}[]>([]);
  const [resLinkAddMode, setResLinkAddMode] = useState(false);
  const [resLinkUrl, setResLinkUrl] = useState('');
  const [resLinkTitle, setResLinkTitle] = useState('');
  const [resLinkDescription, setResLinkDescription] = useState('');

  const handleUploadMaterial = async () => {
    setMatUploading(true);
    try {
      const formData = new FormData();
      formData.append('materialType', matType);
      if (matTitle) formData.append('title', matTitle);
      if (matDescription) formData.append('description', matDescription);
      if (matType === 'FILE' && matFiles?.[0]) {
        formData.append('file', matFiles[0]);
      } else if (matType === 'EXTERNAL_LINK') {
        formData.append('externalUrl', matUrl);
      }
      await materialsApi.add(id, formData);
      queryClient.invalidateQueries({ queryKey: ['card', id] });
      toast.success('Материал добавлен');
      setShowUploadMaterial(false);
      setMatTitle(''); setMatDescription(''); setMatUrl(''); setMatFiles(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Ошибка загрузки');
    } finally {
      setMatUploading(false);
    }
  };

  const handleUploadResult = async () => {
    const hasFiles = resFiles && resFiles.length > 0;
    const hasLinks = resLinks.length > 0;
    if (!hasFiles && !hasLinks) { toast.error('Добавьте хотя бы один файл или ссылку'); return; }
    setResUploading(true);
    try {
      const formData = new FormData();
      if (hasFiles) Array.from(resFiles!).forEach(f => formData.append('files', f));
      if (hasLinks) formData.append('links', JSON.stringify(resLinks));
      if (resComment) formData.append('comment', resComment);
      await resultsApi.createVersion(id, formData);
      queryClient.invalidateQueries({ queryKey: ['card', id] });
      toast.success('Результат загружен');
      setShowUploadResult(false);
      setResFiles(null); setResComment(''); setResLinks([]); setResLinkAddMode(false);
      setResLinkUrl(''); setResLinkTitle(''); setResLinkDescription('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Ошибка загрузки');
    } finally {
      setResUploading(false);
    }
  };

  const copyUrl = (id: string, url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrlId(id);
      toast.success('Ссылка скопирована');
      setTimeout(() => setCopiedUrlId(null), 2000);
    }).catch(() => toast.error('Не удалось скопировать'));
  };

  const { data: card, isLoading, error } = useQuery({
    queryKey: ['card', id],
    queryFn: () => cardsApi.getById(id),
    retry: 1,
  });

  const { data: allUsers } = useQuery({
    queryKey: ['users-directory'],
    queryFn: () => usersApi.getDirectory(),
  });

  const statusMutation = useMutation({
    mutationFn: ({ status, comment, reason }: { status: string; comment?: string; reason?: string }) =>
      cardsApi.changeStatus(id, status, comment, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card', id] });
      toast.success('Статус изменён');
      setShowStatusDialog(false);
      setPendingStatus(null);
      setStatusComment('');
      setStatusReason('');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Ошибка изменения статуса';
      if (err?.response?.status === 400) toast.warning(msg);
      else toast.error(msg);
    },
  });

  const assignMutation = useMutation({
    mutationFn: (dto: { executorId?: string | null; reviewerId?: string | null }) =>
      cardsApi.assign(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card', id] });
      toast.success('Назначение обновлено');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Ошибка назначения');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => cardsApi.delete(id),
    onSuccess: () => {
      toast.success('Карточка удалена');
      router.push('/cards');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Ошибка удаления');
    },
  });

  const { data: watchStatus, refetch: refetchWatch } = useQuery({
    queryKey: ['card-watch', id],
    queryFn: () => cardsApi.getWatchStatus(id),
  });

  const watchMutation = useMutation({
    mutationFn: () => cardsApi.toggleWatch(id),
    onSuccess: (res) => {
      refetchWatch();
      toast.success(res.watching ? 'Вы следите за карточкой' : 'Вы отписались от карточки');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Ошибка');
    },
  });

  const commentMutation = useMutation({
    mutationFn: (text: string) => commentsApi.create(id, { text }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card', id] });
      setNewComment('');
      toast.success('Комментарий добавлен');
    },
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="page-container">
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-24" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !card) {
    return (
      <AppLayout>
        <div className="page-container">
          <div className="card p-8 text-center text-gray-500">
            Карточка не найдена
          </div>
        </div>
      </AppLayout>
    );
  }

  const isLocked = card.isLocked;
  const cardUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/cards/${card.publicId}`
    : `/cards/${card.publicId}`;

  const getNextStatuses = () => {
    const transitions: Record<string, string[]> = {
      NEW: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['REVIEW', 'CANCELLED'],
      REVIEW: ['DONE', 'IN_PROGRESS', 'CANCELLED'],
      DONE: [],
      CANCELLED: [],
    };
    return transitions[card.status] || [];
  };

  const handleStatusClick = (status: string) => {
    setPendingStatus(status);
    setShowStatusDialog(true);
  };

  const handleStatusConfirm = () => {
    if (!pendingStatus) return;
    const needsComment = pendingStatus === 'IN_PROGRESS' && card.status === 'REVIEW';
    const needsReason = pendingStatus === 'CANCELLED';

    if (needsComment && !statusComment.trim()) {
      toast.error('Укажите причину возврата');
      return;
    }
    if (needsReason && !statusReason.trim()) {
      toast.error('Укажите причину отмены');
      return;
    }

    statusMutation.mutate({
      status: pendingStatus,
      comment: statusComment || undefined,
      reason: statusReason || undefined,
    });
  };

  const currentVersion = card.resultVersions?.find((v: any) => v.isCurrent);

  return (
    <AppLayout>
      <div className="page-container">
        {/* Back + Actions header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/cards" className="btn-ghost text-sm">
            <ArrowLeft className="w-4 h-4" />
            Назад к карточкам
          </Link>
          <div className="flex items-center gap-2">
            <CopyLink url={cardUrl} />
            <button
              className={`btn-secondary text-sm ${watchStatus?.watching ? 'text-blue-600 border-blue-300 bg-blue-50 hover:bg-blue-100' : ''}`}
              onClick={() => watchMutation.mutate()}
              disabled={watchMutation.isPending}
              title={watchStatus?.watching ? 'Отписаться от карточки' : 'Следить за карточкой'}
            >
              {watchStatus?.watching
                ? <BellOff className="w-4 h-4" />
                : <Bell className="w-4 h-4" />
              }
              <span>
                {watchStatus?.watching ? 'Отписаться' : 'Следить'}
                {watchStatus?.watcherCount ? ` (${watchStatus.watcherCount})` : ''}
              </span>
            </button>
            {!isLocked && (
              <Link href={`/cards/${card.publicId}/edit`} className="btn-secondary">
                <Edit className="w-4 h-4" />
                Редактировать
              </Link>
            )}
            {user?.role === 'ADMIN' && (
              <button className="btn-danger" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 className="w-4 h-4" />
                Удалить
              </button>
            )}
          </div>
        </div>

        {/* Main card info */}
        <div className="card mb-4">
          <div className="card-header">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="font-mono text-sm text-gray-400">{card.publicId}</span>
                <CardStatusBadge status={card.status} />
                <CardPriorityBadge priority={card.priority} />
                {isLocked && (
                  <span className="badge bg-gray-100 text-gray-500">
                    <Lock className="w-3 h-3" />
                    Закрыта
                  </span>
                )}
              </div>
              <h1 className="text-xl font-semibold text-gray-900">
                {card.dataSource?.name}
                {card.extraTitle && (
                  <span className="text-gray-500 font-normal"> — {card.extraTitle}</span>
                )}
              </h1>
              <div className="text-sm text-gray-500 mt-1">
                {getMonthName(card.month)} {card.year}
              </div>
            </div>

            {/* Status transitions */}
            {!isLocked && getNextStatuses().length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {getNextStatuses().map(status => {
                  const labels: Record<string, string> = {
                    IN_PROGRESS: card.status === 'REVIEW' ? 'Вернуть в работу' : 'Взять в работу',
                    REVIEW: 'Отправить на проверку',
                    DONE: 'Подтвердить готовность',
                    CANCELLED: 'Отменить',
                  };
                  const cls = status === 'DONE' ? 'btn-primary' :
                              status === 'CANCELLED' ? 'btn-danger' : 'btn-secondary';
                  return (
                    <button
                      key={status}
                      className={`${cls} text-sm`}
                      onClick={() => handleStatusClick(status)}
                    >
                      {labels[status] || status}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card-body space-y-4">
            {/* Description — highlighted */}
            {card.description ? (
              <div className="bg-blue-50 border border-blue-100 rounded-sm px-4 py-3">
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{card.description}</p>
              </div>
            ) : null}

            {card.cancelReason && (
              <div className="bg-red-50 border border-red-100 rounded-sm px-4 py-3">
                <span className="text-xs font-medium text-red-500 uppercase tracking-wide">Причина отмены</span>
                <p className="text-sm text-red-700 mt-1">{card.cancelReason}</p>
              </div>
            )}

            {/* Meta row — compact */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1 border-t border-gray-100">
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-gray-400">Срок:</span>
                <span className={card.dueDate && new Date(card.dueDate) < new Date() && card.status !== 'DONE' ? 'text-red-500 font-medium' : 'text-gray-700'}>
                  {card.dueDate ? formatDate(card.dueDate) : '—'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-gray-400">Создал:</span>
                <span className="text-gray-700">{card.createdBy?.fullName}</span>
              </div>

              <div className="flex items-center gap-1.5 text-sm">
                <span className="text-gray-400">Исполнитель:</span>
                {!isLocked ? (
                  <select
                    className="input py-0.5 h-7 text-sm w-auto min-w-32"
                    value={card.executorId || ''}
                    onChange={e => assignMutation.mutate({ executorId: e.target.value || null })}
                  >
                    <option value="">— не назначен —</option>
                    {allUsers?.map((u: any) => (
                      <option key={u.id} value={u.id}>{u.fullName}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-gray-700">{card.executor?.fullName || '—'}</span>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-sm">
                <span className="text-gray-400">Проверяющий:</span>
                {!isLocked ? (
                  <select
                    className="input py-0.5 h-7 text-sm w-auto min-w-32"
                    value={card.reviewerId || ''}
                    onChange={e => assignMutation.mutate({ reviewerId: e.target.value || null })}
                  >
                    <option value="">— не назначен —</option>
                    {allUsers?.map((u: any) => (
                      <option key={u.id} value={u.id}>{u.fullName}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-gray-700">{card.reviewer?.fullName || '—'}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Hierarchy: parent + children */}
        {(card.parent || card.children?.length > 0 || !isLocked) && (
          <div className="card mb-4">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-gray-500" />
                <h2 className="font-semibold text-gray-700">
                  Иерархия
                  {card.children?.length > 0 && (
                    <span className="text-gray-400 font-normal ml-1">({card.children.length})</span>
                  )}
                </h2>
              </div>
              {!isLocked && (
                <Link
                  href={`/cards/new?parentId=${card.id}`}
                  className="btn-secondary text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Дочерняя карточка
                </Link>
              )}
            </div>
            <div className="card-body space-y-3">
              {card.parent && (
                <div>
                  <div className="label">Родительская карточка</div>
                  <Link
                    href={`/cards/${card.parent.publicId}`}
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <span className="font-mono text-gray-400">{card.parent.publicId}</span>
                    <span>
                      {card.parent.dataSource?.name || 'Без источника'}
                      {card.parent.extraTitle && ` — ${card.parent.extraTitle}`}
                    </span>
                  </Link>
                </div>
              )}

              {card.children?.length > 0 && (
                <div>
                  <div className="label">Дочерние карточки</div>
                  <div className="space-y-1.5">
                    {card.children.map((child: any) => (
                      <Link
                        key={child.id}
                        href={`/cards/${child.publicId}`}
                        className="flex items-center gap-2 text-sm hover:bg-gray-50 rounded-sm py-1"
                      >
                        <span className="font-mono text-gray-400 text-xs">{child.publicId}</span>
                        <span className="flex-1 text-gray-700">
                          {child.dataSource?.name || 'Без источника'}
                          {child.extraTitle && ` — ${child.extraTitle}`}
                        </span>
                        <CardStatusBadge status={child.status} />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {!card.parent && card.children?.length === 0 && (
                <p className="text-sm text-gray-400">Нет связанных карточек. Нажмите «Дочерняя карточка» чтобы создать.</p>
              )}
            </div>
          </div>
        )}

        {/* Source materials */}
        <div className="card mb-4">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-gray-500" />
              <h2 className="font-semibold text-gray-700">
                Исходные материалы
                {card.sourceMaterials?.length > 0 && (
                  <span className="text-gray-400 font-normal ml-1">
                    ({card.sourceMaterials.length})
                  </span>
                )}
              </h2>
            </div>
            {!isLocked && (
              <button
                className="btn-secondary text-sm"
                onClick={() => setShowUploadMaterial(!showUploadMaterial)}
              >
                <Plus className="w-4 h-4" />
                Добавить
              </button>
            )}
          </div>

          <div className="card-body">
            {card.sourceMaterials?.length === 0 ? (
              <p className="text-sm text-gray-400">Материалы не прикреплены</p>
            ) : (
              <div className="space-y-2">
                {card.sourceMaterials?.map((mat: any) => (
                  <div key={mat.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {mat.materialType === 'FILE' ? (
                        <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      ) : isLocalPath(mat.externalUrl) ? (
                        <span className="w-4 h-4 flex-shrink-0 text-amber-500">📁</span>
                      ) : (
                        <ExternalLink className="w-4 h-4 text-green-400 flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-700 truncate">{mat.title}</div>
                        {mat.materialType === 'EXTERNAL_LINK' && (
                          <div className="text-xs text-gray-400 font-mono truncate">{mat.externalUrl}</div>
                        )}
                        {mat.description && (
                          <div className="text-xs text-gray-400 truncate">{mat.description}</div>
                        )}
                        {mat.fileSize && (
                          <div className="text-xs text-gray-400">{formatFileSize(Number(mat.fileSize))}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {mat.materialType === 'FILE' ? (
                        <a
                          href={materialsApi.downloadUrl(id, mat.id)}
                          className="btn-ghost text-xs"
                          download
                        >
                          <Download className="w-3 h-3" />
                          Скачать
                        </a>
                      ) : (
                        <button
                          className="btn-ghost text-xs"
                          title="Скопировать"
                          onClick={() => copyUrl(mat.id, mat.externalUrl)}
                        >
                          {copiedUrlId === mat.id
                            ? <Check className="w-3 h-3 text-green-500" />
                            : <Copy className="w-3 h-3" />
                          }
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {card.sourceMaterials?.some((m: any) => m.materialType === 'FILE') && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <a
                  href={materialsApi.downloadAllUrl(id)}
                  className="btn-secondary text-sm"
                  download
                >
                  <Download className="w-4 h-4" />
                  Скачать все файлы (ZIP)
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Results with versioning */}
        <div className="card mb-4">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-500" />
              <h2 className="font-semibold text-gray-700">
                Результаты
                {card.resultVersions?.length > 0 && (
                  <span className="text-gray-400 font-normal ml-1">
                    (v{card.resultVersions.length})
                  </span>
                )}
              </h2>
            </div>
            {!isLocked && (
              <button
                className="btn-secondary text-sm"
                onClick={() => setShowUploadResult(!showUploadResult)}
              >
                <Plus className="w-4 h-4" />
                {card.resultVersions?.length ? 'Загрузить новую версию' : 'Загрузить результат'}
              </button>
            )}
          </div>

          <div className="card-body">
            {card.resultVersions?.length === 0 ? (
              <p className="text-sm text-gray-400">Результаты ещё не загружены</p>
            ) : (
              <div className="space-y-4">
                {card.resultVersions?.map((version: any) => (
                  <div key={version.id} className={`border rounded-sm p-4 ${
                    version.isCurrent ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-gray-50/30'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-700">
                          Версия {version.versionNumber}
                        </span>
                        {version.isCurrent && (
                          <span className="badge badge-done">Актуальная</span>
                        )}
                        <span className="text-xs text-gray-400">
                          {version.createdBy?.fullName} · {formatRelative(version.createdAt)}
                        </span>
                      </div>
                      {version.items?.some((i: any) => i.itemType === 'FILE') && (
                        <a
                          href={resultsApi.downloadVersionAllUrl(id, version.id)}
                          className="btn-secondary text-xs px-3 py-1.5"
                          download
                        >
                          <Download className="w-3 h-3" />
                          Скачать ZIP
                        </a>
                      )}
                    </div>

                    {version.comment && (
                      <p className="text-sm text-gray-600 mb-3 italic">"{version.comment}"</p>
                    )}

                    <div className="space-y-1">
                      {version.items?.map((item: any) => (
                        <div key={item.id} className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 text-sm text-gray-600 min-w-0 flex-1">
                            {item.itemType === 'FILE' ? (
                              <FileText className="w-3 h-3 text-blue-400 flex-shrink-0 mt-0.5" />
                            ) : isLocalPath(item.externalUrl) ? (
                              <span className="flex-shrink-0 mt-0.5">📁</span>
                            ) : (
                              <ExternalLink className="w-3 h-3 text-green-400 flex-shrink-0 mt-0.5" />
                            )}
                            <div className="min-w-0">
                              <div className="truncate">{item.title}</div>
                              {item.itemType === 'EXTERNAL_LINK' && (
                                <div className="text-xs text-gray-400 font-mono truncate">{item.externalUrl}</div>
                              )}
                              {item.fileSize && (
                                <span className="text-xs text-gray-400">
                                  ({formatFileSize(Number(item.fileSize))})
                                </span>
                              )}
                            </div>
                          </div>
                          {item.itemType === 'FILE' ? (
                            <a
                              href={resultsApi.downloadItemUrl(id, version.id, item.id)}
                              className="text-xs text-primary hover:underline flex-shrink-0"
                              download
                            >
                              Скачать
                            </a>
                          ) : (
                            <button
                              className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0"
                              title="Скопировать"
                              onClick={() => copyUrl(item.id, item.externalUrl)}
                            >
                              {copiedUrlId === item.id
                                ? <Check className="w-3 h-3 text-green-500" />
                                : <Copy className="w-3 h-3" />
                              }
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Comments — only for active (non-locked) cards, or if there are existing comments to show */}
        {(!isLocked || card.comments?.length > 0) && (
          <div className="card mb-4">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-gray-500" />
                <h2 className="font-semibold text-gray-700">
                  Комментарии проверки
                  {card.comments?.length > 0 && (
                    <span className="text-gray-400 font-normal ml-1">({card.comments.length})</span>
                  )}
                </h2>
              </div>
            </div>
            <div className="card-body">
              {/* New comment — only for active cards */}
              {!isLocked && (
                <div className="mb-4">
                  <textarea
                    className="input min-h-20 resize-none"
                    placeholder="Добавить комментарий..."
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                  />
                  <button
                    className="btn-primary text-sm mt-2"
                    disabled={!newComment.trim() || commentMutation.isPending}
                    onClick={() => commentMutation.mutate(newComment)}
                  >
                    Отправить комментарий
                  </button>
                </div>
              )}

              {/* Comments list */}
              {card.comments?.length === 0 ? (
                <p className="text-sm text-gray-400">Комментариев нет</p>
              ) : (
                <div className="space-y-3">
                  {card.comments?.map((comment: any) => (
                    <div key={comment.id} className="border-l-2 border-gray-200 pl-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-700">
                          {comment.author?.fullName}
                        </span>
                        {comment.resultVersion && (
                          <span className="badge badge-review text-xs">
                            к v{comment.resultVersion.versionNumber}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {formatRelative(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{comment.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Delete confirm dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-sm shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-semibold mb-2">Удалить карточку?</h3>
            <p className="text-sm text-gray-500 mb-6">
              Карточка <span className="font-mono font-medium text-gray-700">{card.publicId}</span> и все связанные файлы будут удалены безвозвратно.
            </p>
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
                Отмена
              </button>
              <button
                className="btn-danger"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                {deleteMutation.isPending ? 'Удаление...' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload material dialog */}
      {showUploadMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowUploadMaterial(false)} />
          <div className="relative bg-white rounded-sm shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-base font-semibold mb-4">Добавить исходный материал</h3>

            <div className="mb-4">
              <label className="label">Тип</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" checked={matType === 'FILE'} onChange={() => setMatType('FILE')} />
                  Файл
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" checked={matType === 'EXTERNAL_LINK'} onChange={() => setMatType('EXTERNAL_LINK')} />
                  Внешняя ссылка
                </label>
              </div>
            </div>

            {matType === 'FILE' ? (
              <div className="mb-4">
                <label className="label label-required">Файл</label>
                <input
                  type="file"
                  className="input"
                  onChange={e => setMatFiles(e.target.files)}
                />
              </div>
            ) : (
              <div className="mb-4">
                <label className="label label-required">Ссылка или путь к папке</label>
                <input
                  type="text"
                  className="input"
                  placeholder="https://... или \\server\папка или C:\путь"
                  value={matUrl}
                  onChange={e => setMatUrl(e.target.value)}
                />
              </div>
            )}

            <div className="mb-4">
              <label className="label">Название</label>
              <input
                type="text"
                className="input"
                placeholder={matType === 'FILE' ? 'Оставьте пустым — будет имя файла' : 'Название ссылки'}
                value={matTitle}
                onChange={e => setMatTitle(e.target.value)}
              />
            </div>

            <div className="mb-6">
              <label className="label">Описание</label>
              <input
                type="text"
                className="input"
                placeholder="Краткое описание (необязательно)"
                value={matDescription}
                onChange={e => setMatDescription(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setShowUploadMaterial(false)}>
                Отмена
              </button>
              <button
                className="btn-primary"
                disabled={matUploading || (matType === 'FILE' ? !matFiles?.[0] : !matUrl.trim())}
                onClick={handleUploadMaterial}
              >
                {matUploading ? 'Загрузка...' : 'Добавить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload result dialog */}
      {showUploadResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowUploadResult(false)} />
          <div className="relative bg-white rounded-sm shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold mb-4">
              {card.resultVersions?.length ? 'Загрузить новую версию результата' : 'Загрузить результат'}
            </h3>

            {/* Files */}
            <div className="mb-4">
              <label className="label">Файлы</label>
              <input
                type="file"
                className="input"
                multiple
                onChange={e => setResFiles(e.target.files)}
              />
              <p className="text-xs text-gray-400 mt-1">Можно выбрать несколько файлов</p>
            </div>

            {/* Links section */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Ссылки</label>
                {!resLinkAddMode && (
                  <button
                    type="button"
                    className="btn-secondary text-xs px-2 py-1"
                    onClick={() => setResLinkAddMode(true)}
                  >
                    <Plus className="w-3 h-3" />
                    Добавить ссылку
                  </button>
                )}
              </div>

              {resLinkAddMode && (
                <div className="border border-gray-200 rounded-sm p-3 space-y-2 bg-gray-50 mb-2">
                  <div>
                    <label className="label text-xs">Ссылка или путь <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      className="input text-sm"
                      placeholder="https://... или \\server\папка или C:\путь"
                      value={resLinkUrl}
                      onChange={e => setResLinkUrl(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label text-xs">Название</label>
                    <input
                      type="text"
                      className="input text-sm"
                      placeholder="Оставьте пустым — будет URL"
                      value={resLinkTitle}
                      onChange={e => setResLinkTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label text-xs">Описание</label>
                    <input
                      type="text"
                      className="input text-sm"
                      placeholder="Необязательно"
                      value={resLinkDescription}
                      onChange={e => setResLinkDescription(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-primary text-xs px-3 py-1.5"
                      onClick={() => {
                        if (!resLinkUrl.trim()) { toast.error('Введите URL'); return; }
                        setResLinks(l => [...l, { url: resLinkUrl, title: resLinkTitle, description: resLinkDescription }]);
                        setResLinkAddMode(false); setResLinkUrl(''); setResLinkTitle(''); setResLinkDescription('');
                      }}
                    >
                      Добавить
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-xs px-3 py-1.5"
                      onClick={() => { setResLinkAddMode(false); setResLinkUrl(''); setResLinkTitle(''); setResLinkDescription(''); }}
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}

              {resLinks.length > 0 && (
                <div className="space-y-1">
                  {resLinks.map((lnk, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm py-1 border-b border-gray-100 last:border-0">
                      <ExternalLink className="w-3 h-3 text-green-400 flex-shrink-0" />
                      <span className="flex-1 truncate text-gray-700">{lnk.title || lnk.url}</span>
                      <button
                        type="button"
                        className="text-gray-400 hover:text-red-500"
                        onClick={() => setResLinks(l => l.filter((_, j) => j !== i))}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-6">
              <label className="label">Комментарий к версии</label>
              <textarea
                className="input min-h-20 resize-none"
                placeholder="Что изменено или добавлено (необязательно)..."
                value={resComment}
                onChange={e => setResComment(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => {
                setShowUploadResult(false);
                setResLinks([]); setResLinkAddMode(false);
                setResLinkUrl(''); setResLinkTitle(''); setResLinkDescription('');
              }}>
                Отмена
              </button>
              <button
                className="btn-primary"
                disabled={resUploading || (!resFiles?.length && resLinks.length === 0)}
                onClick={handleUploadResult}
              >
                {resUploading ? 'Загрузка...' : 'Загрузить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status change dialog */}
      {showStatusDialog && pendingStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowStatusDialog(false)} />
          <div className="relative bg-white rounded-sm shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-base font-semibold mb-4">
              {pendingStatus === 'CANCELLED' ? 'Отмена карточки' :
               pendingStatus === 'IN_PROGRESS' && card.status === 'REVIEW' ? 'Возврат с замечаниями' :
               pendingStatus === 'DONE' ? 'Подтверждение готовности' :
               'Изменение статуса'}
            </h3>

            {pendingStatus === 'CANCELLED' && (
              <div className="mb-4">
                <label className="label label-required">Причина отмены</label>
                <textarea
                  className="input min-h-20"
                  placeholder="Опишите причину отмены карточки..."
                  value={statusReason}
                  onChange={e => setStatusReason(e.target.value)}
                />
              </div>
            )}

            {pendingStatus === 'IN_PROGRESS' && card.status === 'REVIEW' && (
              <div className="mb-4">
                <label className="label label-required">Замечания</label>
                <textarea
                  className="input min-h-24"
                  placeholder="Опишите обнаруженные ошибки или замечания..."
                  value={statusComment}
                  onChange={e => setStatusComment(e.target.value)}
                />
              </div>
            )}

            {pendingStatus === 'DONE' && (
              <div className="mb-4">
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-sm text-sm text-green-700">
                  <Lock className="w-4 h-4 flex-shrink-0" />
                  Карточка будет закрыта. После этого редактирование станет недоступным.
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                className="btn-secondary"
                onClick={() => setShowStatusDialog(false)}
              >
                Отмена
              </button>
              <button
                className={pendingStatus === 'CANCELLED' ? 'btn-danger' :
                           pendingStatus === 'DONE' ? 'btn-primary' : 'btn-primary'}
                onClick={handleStatusConfirm}
                disabled={statusMutation.isPending}
              >
                {statusMutation.isPending ? 'Выполняется...' : 'Подтвердить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
