'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowLeft, Edit3, Trash2, Lock, User, Calendar, AlertTriangle,
  Paperclip, FileText, MessageSquare,
  Download, Plus, Link as LinkIcon, ExternalLink, Copy, Check, X, Bell, BellOff, GitBranch, ChevronDown, ChevronUp, BookOpen, Unlink2, Boxes, ClipboardList,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { CardStatusBadge } from '@/components/cards/CardStatusBadge';
import { CardPriorityBadge } from '@/components/cards/CardPriorityBadge';
import { CopyLink } from '@/components/shared/CopyLink';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ExternalUrlLink } from '@/components/shared/ExternalUrlLink';
import { MentionText } from '@/components/shared/MentionText';
import { MentionTextarea } from '@/components/shared/MentionTextarea';
import { CardInstructionsSidebar } from '@/components/instructions/CardInstructionsSidebar';
import { CardComponentsSidebar } from '@/components/components/CardComponentsSidebar';
import { CardReviewProtocolSidebar } from '@/components/review-protocols/CardReviewProtocolSidebar';
import { ComponentLocationActions } from '@/components/components/ComponentLocationActions';
import { isLocalPath } from '@/lib/utils';
import { displayUserName } from '@/lib/user-display';
import { cardsApi, materialsApi, resultsApi, commentsApi, usersApi, getAccessToken } from '@/lib/api';
import { instructionsApi } from '@/lib/api/instructions';
import { componentsApi } from '@/lib/api/components';
import { reviewProtocolsApi } from '@/lib/api/reviewProtocols';
import {
  formatDate, formatRelative, formatFileSize,
} from '@/lib/utils';
import { useAuthStore } from '@/lib/store/auth.store';

type HierarchyNode = {
  id: string;
  publicId: string;
  title: string;
  href?: string;
  status?: string;
  isCurrent?: boolean;
  children?: HierarchyNode[];
};

function getHierarchyTitle(item: { dataSource?: { name?: string | null } | null; extraTitle?: string | null }) {
  const sourceName = item.dataSource?.name?.trim();
  const extraTitle = item.extraTitle?.trim();

  if (sourceName && extraTitle) {
    return `${sourceName} — ${extraTitle}`;
  }

  return sourceName || extraTitle || 'Карточка';
}

function HierarchyTreeNode({ node, depth = 0 }: { node: HierarchyNode; depth?: number }) {
  const hasChildren = (node.children?.length || 0) > 0;
  const content = (
    <div
      className={`flex min-w-0 items-start gap-3 rounded-2xl border px-4 py-3 transition ${
        node.isCurrent
          ? 'border-blue-200 bg-blue-50/80 shadow-sm'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80'
      }`}
    >
      <div className="mt-1 flex h-2.5 w-2.5 flex-shrink-0 rounded-full bg-slate-300">
        <span className={`h-2.5 w-2.5 rounded-full ${node.isCurrent ? 'bg-blue-500' : 'bg-slate-300'}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-slate-400">{node.publicId}</span>
          {node.isCurrent && <span className="badge badge-review text-xs">Текущая</span>}
          {node.status && <CardStatusBadge status={node.status} />}
        </div>
        <div className="mt-1 break-words text-sm font-medium text-slate-800">{node.title}</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex min-w-0 items-start gap-3">
        {depth > 0 && <div className="mt-5 h-px w-4 flex-shrink-0 bg-slate-300" />}
        <div className="min-w-0 flex-1">
          {node.href ? (
            <Link href={node.href} className="block">
              {content}
            </Link>
          ) : (
            content
          )}
        </div>
      </div>

      {hasChildren && (
        <div className="ml-3 border-l border-dashed border-slate-300 pl-5">
          <div className="space-y-3">
            {node.children!.map((child) => (
              <HierarchyTreeNode key={child.id} node={child} depth={depth + 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [tokenReady, setTokenReady] = useState(() => !!getAccessToken());
  const [copiedUrlId, setCopiedUrlId] = useState<string | null>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [statusComment, setStatusComment] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showUploadMaterial, setShowUploadMaterial] = useState(false);
  const [showUploadResult, setShowUploadResult] = useState(false);
  const [showInstructionsSidebar, setShowInstructionsSidebar] = useState(false);
  const [showComponentsSidebar, setShowComponentsSidebar] = useState(false);
  const [showReviewProtocolSidebar, setShowReviewProtocolSidebar] = useState(false);
  const [showReviewProtocolRemoveConfirm, setShowReviewProtocolRemoveConfirm] = useState(false);
  const [showCloseCardNowConfirm, setShowCloseCardNowConfirm] = useState(false);
  const [selectedComponentRef, setSelectedComponentRef] = useState<string | null>(null);
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
  const [showPreviousResults, setShowPreviousResults] = useState(false);
  const [showHierarchy, setShowHierarchy] = useState(false);

  useEffect(() => {
    if (getAccessToken()) {
      setTokenReady(true);
      return;
    }

    const intervalId = window.setInterval(() => {
      if (getAccessToken()) {
        setTokenReady(true);
        window.clearInterval(intervalId);
      }
    }, 100);

    return () => window.clearInterval(intervalId);
  }, []);

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

  const extractFileName = (contentDisposition?: string, fallback = 'download') => {
    if (!contentDisposition) {
      return fallback;
    }

    const utf8Match = contentDisposition.match(/filename\*\=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      return decodeURIComponent(utf8Match[1]);
    }

    const plainMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
    if (plainMatch?.[1]) {
      return plainMatch[1];
    }

    return fallback;
  };

  const saveBlob = (blob: Blob, fileName: string) => {
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(objectUrl);
  };

  const handleDownloadMaterial = async (materialId: string, fallbackName: string) => {
    try {
      const { blob, contentDisposition } = await materialsApi.download(id, materialId);
      saveBlob(blob, extractFileName(contentDisposition, fallbackName));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Не удалось скачать материал');
    }
  };

  const handleDownloadAllMaterials = async () => {
    try {
      const { blob, contentDisposition } = await materialsApi.downloadAll(id);
      saveBlob(blob, extractFileName(contentDisposition, `${id}-materials.zip`));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Не удалось скачать архив материалов');
    }
  };

  const handleDownloadResultZip = async (versionId: string) => {
    try {
      const { blob, contentDisposition } = await resultsApi.downloadVersionAll(id, versionId);
      saveBlob(blob, extractFileName(contentDisposition, `${id}-results.zip`));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Не удалось скачать архив результата');
    }
  };

  const handleDownloadResultItem = async (versionId: string, itemId: string, fallbackName: string) => {
    try {
      const { blob, contentDisposition } = await resultsApi.downloadItem(id, versionId, itemId);
      saveBlob(blob, extractFileName(contentDisposition, fallbackName));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Не удалось скачать файл результата');
    }
  };

  const canLoadCard = tokenReady;

  const { data: card, isLoading, error } = useQuery({
    queryKey: ['card', id],
    queryFn: () => cardsApi.getById(id),
    retry: 1,
    enabled: canLoadCard,
  });

  const { data: allUsers } = useQuery({
    queryKey: ['users-directory'],
    queryFn: () => usersApi.getDirectory(),
    enabled: canLoadCard,
  });

  const assignableUsers = (allUsers || []).filter((candidate: any) => candidate.role !== 'ADMIN');

  const { data: linkedInstructions } = useQuery({
    queryKey: ['card-instructions', id],
    queryFn: () => instructionsApi.getCardInstructions(id),
    enabled: canLoadCard,
  });

  const { data: linkedComponents } = useQuery({
    queryKey: ['card-components', id],
    queryFn: () => componentsApi.getCardComponents(id),
    enabled: canLoadCard,
  });

  const {
    data: selectedComponent,
    isLoading: isComponentLoading,
    isError: isComponentError,
  } = useQuery({
    queryKey: ['card-component', selectedComponentRef],
    queryFn: () => componentsApi.getById(selectedComponentRef!),
    enabled: !!selectedComponentRef && canLoadCard,
  });

  const statusMutation = useMutation({
    mutationFn: ({ status, comment, reason, force }: { status: string; comment?: string; reason?: string; force?: boolean }) =>
      cardsApi.changeStatus(id, status, comment, reason, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kanban'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-list'] });
      queryClient.invalidateQueries({ queryKey: ['all-cards-kanban'] });
      queryClient.invalidateQueries({ queryKey: ['all-cards'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-cards'] });
      toast.success('Статус изменён');
      closeStatusDialog();
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
    enabled: canLoadCard,
  });

  const watchMutation = useMutation({
    mutationFn: () => cardsApi.toggleWatch(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-kanban'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-list'] });
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

  const detachInstructionMutation = useMutation({
    mutationFn: (instructionId: string) => instructionsApi.detachFromCard(id, instructionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card-instructions', id] });
      toast.success('Инструкция откреплена от карточки');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Не удалось открепить инструкцию');
    },
  });

  const detachComponentMutation = useMutation({
    mutationFn: (componentId: string) => componentsApi.detachFromCard(id, componentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card-components', id] });
      toast.success('Компонент убран из карточки');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Не удалось убрать компонент');
    },
  });

  const toggleReviewProtocolItemMutation = useMutation({
    mutationFn: (itemId: string) => reviewProtocolsApi.toggleCardItem(id, itemId),
    onSuccess: (_updatedItem, itemId) => {
      const toggledItem = reviewProtocol?.items?.find((item: any) => item.id === itemId);
      const isLastUncheckedItem =
        !!toggledItem &&
        !toggledItem.isChecked &&
        (reviewProtocol?.items?.filter((item: any) => !item.isChecked).length || 0) === 1;

      queryClient.invalidateQueries({ queryKey: ['card', id] });
      toast.success('Пункт протокола обновлён');

      if (isLastUncheckedItem && canReviewCard) {
        setShowCloseCardNowConfirm(true);
      }
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Не удалось обновить пункт протокола');
    },
  });

  const detachReviewProtocolMutation = useMutation({
    mutationFn: () => reviewProtocolsApi.detachFromCard(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card', id] });
      queryClient.invalidateQueries({ queryKey: ['card-review-protocol', id] });
      toast.success('Протокол убран из карточки');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Не удалось убрать протокол');
    },
  });

  if (!canLoadCard || isLoading) {
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
  const isAdmin = user?.role === 'ADMIN';
  const isExecutor = !!user?.id && card.executorId === user.id;
  const isReviewer = !!user?.id && card.reviewerId === user.id;
  const isCreator = !!user?.id && card.createdById === user.id;
  const isInformationalCard = !!card.withoutSourceMaterials;
  const canEditWorkingCard = !isLocked && (isAdmin || (card.status === 'IN_PROGRESS' && isExecutor));
  const canReviewCard = !isLocked && (isAdmin || (card.status === 'REVIEW' && isReviewer));
  const canCommentInformationalCard =
    isInformationalCard && !isLocked && (isAdmin || isCreator || isExecutor || isReviewer);
  const canAddInlineComment = canCommentInformationalCard;
  const canCreateChildCard = !isLocked && (isAdmin || isCreator || isExecutor || isReviewer);
  const showCommentsSection = (card.comments?.length ?? 0) > 0;
  const canManageInstructionLinks = !isLocked && (isAdmin || isCreator || isExecutor || isReviewer);
  const canManageComponentLinks = !isLocked && (isAdmin || isCreator || isExecutor || isReviewer);
  const canDetachInstructionLinks = !isLocked && (isAdmin || (card.status === 'REVIEW' ? isReviewer : (isCreator || isExecutor || isReviewer)));
  const canDetachComponentLinks = !isLocked && (isAdmin || (card.status === 'REVIEW' ? isReviewer : (isCreator || isExecutor || isReviewer)));
  const canManageReviewProtocol = !isLocked && (isAdmin || isCreator || isExecutor || isReviewer);
  const canRemoveReviewProtocol = !isLocked && (isAdmin || isReviewer);
  const reviewProtocol = card.reviewProtocol || null;
  const hasReviewProtocolSection = card.status === 'REVIEW' && !!reviewProtocol;
  const completedProtocolItems = reviewProtocol?.items?.filter((item: any) => item.isChecked).length || 0;
  const hasUncheckedReviewProtocolItems = (reviewProtocol?.items?.some((item: any) => !item.isChecked) || false);
  const canManageAssignments = !isLocked && isAdmin;
  const canCancelCard = !isLocked && ['NEW', 'IN_PROGRESS', 'REVIEW'].includes(card.status);
  const cardUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/cards/${card.publicId}`
    : `/cards/${card.publicId}`;

  const getNextStatuses = () => {
    if (isAdmin) {
      const transitions: Record<string, string[]> = {
        NEW: ['IN_PROGRESS', 'CANCELLED'],
        IN_PROGRESS: ['REVIEW', 'CANCELLED'],
        REVIEW: ['DONE', 'IN_PROGRESS', 'CANCELLED'],
        DONE: [],
        CANCELLED: [],
      };
      return transitions[card.status] || [];
    }

    if (card.status === 'NEW' && isExecutor) return ['IN_PROGRESS'];
    if (card.status === 'IN_PROGRESS' && isExecutor) {
      return canCancelCard ? ['REVIEW', 'CANCELLED'] : ['REVIEW'];
    }
    if (card.status === 'REVIEW' && isReviewer) {
      return canCancelCard ? ['DONE', 'IN_PROGRESS', 'CANCELLED'] : ['DONE', 'IN_PROGRESS'];
    }
    return canCancelCard ? ['CANCELLED'] : [];
  };

  const handleStatusClick = (status: string) => {
    setPendingStatus(status);
    setShowStatusDialog(true);
  };

  const closeStatusDialog = () => {
    setShowStatusDialog(false);
    setPendingStatus(null);
    setStatusComment('');
    setStatusReason('');
  };

  const handleStatusConfirm = () => {
    if (!pendingStatus) return;
    const needsComment = pendingStatus === 'IN_PROGRESS' && card.status === 'REVIEW';
    const needsReason = pendingStatus === 'CANCELLED';

    if (!isAdmin && needsComment && !statusComment.trim() && !hasUncheckedReviewProtocolItems) {
      toast.error('Укажите причину возврата');
      return;
    }
    if (!isAdmin && needsReason && !statusReason.trim()) {
      toast.error('Укажите причину отмены');
      return;
    }

    statusMutation.mutate({
      status: pendingStatus,
      comment: statusComment || undefined,
      reason: statusReason || undefined,
      force: isAdmin,
    });
  };

  const currentVersion = card.resultVersions?.find((v: any) => v.isCurrent);
  const isOverdue = !!card.dueDate && new Date(card.dueDate) < new Date() && card.status !== 'DONE';
  const previousVersions = card.resultVersions?.filter((v: any) => !v.isCurrent) || [];
  const hasHierarchyRelations = !!card.parent || (card.children?.length ?? 0) > 0;
  const shouldHideResultsSection = card.withoutResult && (card.status === 'DONE' || card.status === 'CANCELLED');
  const hierarchyTree: HierarchyNode = card.parent
    ? {
        id: card.parent.id,
        publicId: card.parent.publicId,
        title: getHierarchyTitle(card.parent),
        href: `/cards/${card.parent.publicId}`,
        children: [
          {
            id: card.id,
            publicId: card.publicId,
            title: getHierarchyTitle(card),
            status: card.status,
            isCurrent: true,
            children: (card.children || []).map((child: any) => ({
              id: child.id,
              publicId: child.publicId,
              title: getHierarchyTitle(child),
              href: `/cards/${child.publicId}`,
              status: child.status,
            })),
          },
        ],
      }
    : {
        id: card.id,
        publicId: card.publicId,
        title: getHierarchyTitle(card),
        status: card.status,
        isCurrent: true,
        children: (card.children || []).map((child: any) => ({
          id: child.id,
          publicId: child.publicId,
          title: getHierarchyTitle(child),
          href: `/cards/${child.publicId}`,
          status: child.status,
        })),
      };

  const renderResultVersion = (version: any, isHistorical = false) => (
    <div
      key={version.id}
      className={`result-version-card ${isHistorical ? 'result-version-card-historical' : 'result-version-card-current'}`}
    >
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="result-version-title">
            Версия {version.versionNumber}
          </span>
          {!isHistorical && (
            <span className="badge badge-done">Актуальная</span>
          )}
          <span className="result-version-meta">
            {displayUserName(version.createdBy, user?.id)} · {formatRelative(version.createdAt)}
          </span>
        </div>
        {version.items?.some((i: any) => i.itemType === 'FILE') && (
            <button
              type="button"
              onClick={() => handleDownloadResultZip(version.id)}
              className="btn-secondary text-xs px-3 py-1.5 shrink-0"
            >
              <Download className="w-3 h-3" />
              Скачать ZIP
            </button>
          )}
      </div>

      {version.comment && (
        <p className="result-version-comment">"{version.comment}"</p>
      )}

      <div className="space-y-1">
        {version.items?.map((item: any) => (
          <div key={item.id} className="flex items-start justify-between gap-2">
            <div className="result-version-item flex min-w-0 flex-1 items-start gap-2 text-sm">
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
                  <div className="result-version-link truncate font-mono text-xs">{item.externalUrl}</div>
                )}
                {item.fileSize && (
                  <span className="result-version-link text-xs">
                    ({formatFileSize(Number(item.fileSize))})
                  </span>
                )}
              </div>
            </div>
            {item.itemType === 'FILE' ? (
                <button
                  type="button"
                  onClick={() => handleDownloadResultItem(version.id, item.id, item.title || 'result-file')}
                  className="text-xs text-primary hover:underline flex-shrink-0"
                >
                  Скачать
                </button>
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
  );

  return (
    <AppLayout>
      <div className="page-container">
        <div className="page-hero">
          <div className="page-hero-body">
            <div className="page-title-row">
              <div className="flex-1 min-w-0">
                <div className="page-kicker">Карточки</div>
                <div className="mt-3 flex items-center gap-2 text-sm font-mono text-slate-400">
                  <span>{card.publicId}</span>
                  {isLocked && <Lock className="w-3.5 h-3.5" aria-label="Карточка закрыта" />}
                </div>
                  <h1 className="mt-4 whitespace-nowrap text-2xl font-semibold leading-tight text-slate-900">
                  {card.dataSource?.name || card.extraTitle || 'Карточка'}
                  {card.dataSource?.name && card.extraTitle && (
                    <span className="text-slate-500 font-normal"> — {card.extraTitle}</span>
                  )}
                </h1>
                <p className="page-subtitle">
                  Обновлено {formatRelative(card.updatedAt)}.
                </p>
              </div>

              <div className="card-action-stack">
                <div className="card-action-toolbar">
                  <Link href="/cards" className="toolbar-button toolbar-button-ghost">
                    <ArrowLeft className="w-4 h-4" />
                    Назад к карточкам
                  </Link>
                  <CopyLink
                    url={cardUrl}
                    iconOnly
                    className="toolbar-button toolbar-button-ghost toolbar-button-icon"
                  />
                  <button
                    className={`toolbar-button toolbar-button-secondary ${watchStatus?.watching ? 'toolbar-button-active' : ''}`}
                    onClick={() => watchMutation.mutate()}
                    disabled={watchMutation.isPending}
                    title={watchStatus?.watching ? 'Отписаться от карточки' : 'Следить за карточкой'}
                  >
                    {watchStatus?.watching
                      ? <BellOff className="w-4 h-4" />
                      : <Bell className="w-4 h-4" />
                    }
                    <span>
                      {watchStatus?.watching ? 'Не следить' : 'Следить'}
                      {watchStatus?.watcherCount ? ` (${watchStatus.watcherCount})` : ''}
                    </span>
                  </button>
                  {(canManageInstructionLinks || (linkedInstructions?.length ?? 0) > 0) && (
                    <button
                      type="button"
                      className={`toolbar-button toolbar-button-secondary toolbar-button-icon ${showInstructionsSidebar ? 'toolbar-button-active' : ''}`}
                      onClick={() => setShowInstructionsSidebar((value) => !value)}
                      title={
                        showInstructionsSidebar
                          ? 'Скрыть панель инструкций'
                          : `Показать панель инструкций${linkedInstructions?.length ? ` (${linkedInstructions.length})` : ''}`
                      }
                      aria-label="Инструкции"
                    >
                      <BookOpen className="w-4 h-4" />
                    </button>
                  )}
                    {(canManageComponentLinks || (linkedComponents?.length ?? 0) > 0) && (
                      <button
                        type="button"
                      className={`toolbar-button toolbar-button-secondary toolbar-button-icon ${showComponentsSidebar ? 'toolbar-button-active' : ''}`}
                      onClick={() => setShowComponentsSidebar((value) => !value)}
                      title={
                        showComponentsSidebar
                          ? 'Скрыть панель компонентов'
                          : `Показать панель компонентов${linkedComponents?.length ? ` (${linkedComponents.length})` : ''}`
                      }
                      aria-label="Компоненты"
                    >
                        <Boxes className="w-4 h-4" />
                      </button>
                    )}
                    {(canManageReviewProtocol || reviewProtocol) && (
                      <button
                        type="button"
                        className={`toolbar-button toolbar-button-secondary toolbar-button-icon ${showReviewProtocolSidebar ? 'toolbar-button-active' : ''}`}
                        onClick={() => setShowReviewProtocolSidebar((value) => !value)}
                        title={
                          showReviewProtocolSidebar
                            ? 'Скрыть панель протокола проверки'
                            : reviewProtocol
                            ? 'Показать панель протокола проверки'
                            : 'Прикрепить протокол проверки'
                        }
                        aria-label="Протокол проверки"
                      >
                        <ClipboardList className="w-4 h-4" />
                      </button>
                    )}
                    {canEditWorkingCard && (
                    <Link
                      href={`/cards/${card.publicId}/edit`}
                      className="toolbar-button toolbar-button-secondary toolbar-button-icon"
                      title="Редактировать карточку"
                      aria-label="Редактировать карточку"
                    >
                      <Edit3 className="w-4 h-4" />
                    </Link>
                  )}
                  {user?.role === 'ADMIN' && (
                    <button
                      className="toolbar-button toolbar-button-danger toolbar-button-icon"
                      onClick={() => setShowDeleteConfirm(true)}
                      title="Удалить карточку"
                      aria-label="Удалить карточку"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {!isLocked && getNextStatuses().length > 0 && (
              <div className="card-status-toolbar">
                <span className="card-status-toolbar-label">Действия по статусу</span>
                <div className="card-status-toolbar-actions">
                  {getNextStatuses().map(status => {
                    const labels: Record<string, string> = {
                      IN_PROGRESS: card.status === 'REVIEW' ? 'Вернуть в работу' : 'Взять в работу',
                      REVIEW: 'Отправить на проверку',
                      DONE: 'Подтвердить готовность',
                      CANCELLED: 'Отменить',
                    };
                    const cls = status === 'DONE'
                      ? 'toolbar-button toolbar-button-primary'
                      : status === 'CANCELLED'
                        ? 'toolbar-button toolbar-button-danger'
                        : 'toolbar-button toolbar-button-secondary';
                    return (
                      <button
                        key={status}
                        className={cls}
                        onClick={() => handleStatusClick(status)}
                      >
                        {labels[status] || status}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-4 mt-5">
              {card.description ? (
                <div className="soft-note bg-blue-50 border-blue-100">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                    <MentionText text={card.description} />
                  </p>
                </div>
              ) : null}

              {card.cancelReason && (
                <div className="soft-note bg-red-50 border-red-100">
                  <span className="text-xs font-medium text-red-500 uppercase tracking-wide">Причина отмены</span>
                  <p className="text-sm text-red-700 mt-1 whitespace-pre-wrap">
                    <MentionText text={card.cancelReason} />
                  </p>
                </div>
              )}

              <div className="meta-grid">
                <div className="meta-panel">
                  <div className="meta-label">Срок</div>
                  <div className={`meta-value ${isOverdue ? 'text-red-500 font-medium' : ''}`}>
                    {card.dueDate ? formatDate(card.dueDate) : 'Не указан'}
                  </div>
                </div>
                <div className="meta-panel">
                  <div className="meta-label">Создал</div>
                    <div className="meta-value">{displayUserName(card.createdBy, user?.id) || '—'}</div>
                </div>
                <div className="meta-panel">
                  <div className="meta-label">Исполнитель</div>
                  {canManageAssignments ? (
                    <select
                      className="input h-9 text-sm"
                      value={card.executorId || ''}
                      onChange={e => assignMutation.mutate({ executorId: e.target.value || null })}
                    >
                      {assignableUsers.map((u: any) => (
                        <option key={u.id} value={u.id}>{displayUserName(u, user?.id)}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="meta-value">{displayUserName(card.executor, user?.id) || '—'}</div>
                  )}
                </div>
                <div className="meta-panel">
                  <div className="meta-label">Проверяющий</div>
                  {canManageAssignments ? (
                    <select
                      className="input h-9 text-sm"
                      value={card.reviewerId || ''}
                      onChange={e => assignMutation.mutate({ reviewerId: e.target.value || null })}
                    >
                      {assignableUsers.map((u: any) => (
                        <option key={u.id} value={u.id}>{displayUserName(u, user?.id)}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="meta-value">{displayUserName(card.reviewer, user?.id) || '—'}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hierarchy: parent + children */}
        {(card.parent || card.children?.length > 0 || !isLocked) && (
          <div className="section-surface">
            <div className="section-surface-header">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-gray-500" />
                <div>
                  <h2 className="section-surface-title">
                    Иерархия
                    {card.children?.length > 0 && (
                      <span className="text-gray-400 font-normal ml-1">({card.children.length})</span>
                    )}
                  </h2>
                  <p className="section-surface-subtitle">Связи с родительской и дочерними карточками.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hasHierarchyRelations && (
                  <button
                    type="button"
                    className="toolbar-button toolbar-button-secondary"
                    onClick={() => setShowHierarchy((value) => !value)}
                  >
                    {showHierarchy ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {showHierarchy ? 'Свернуть' : 'Развернуть'}
                  </button>
                )}
                {canCreateChildCard && (
                  <Link
                    href={`/cards/new?parentId=${card.id}`}
                    className="btn-secondary text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Дочерняя карточка
                  </Link>
                )}
              </div>
            </div>
            {showHierarchy && (
              <div className="card-body space-y-3">
                {hasHierarchyRelations && <HierarchyTreeNode node={hierarchyTree} />}

                {!hasHierarchyRelations && canCreateChildCard && (
                  <p className="text-sm text-gray-400">Нет связанных карточек. Нажмите «Дочерняя карточка» чтобы создать.</p>
                )}
              </div>
            )}
          </div>
        )}

        {hasReviewProtocolSection && (
          <div className="section-surface">
            <div className="section-surface-header">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-gray-500" />
                <div>
                  <h2 className="section-surface-title">Протокол проверки</h2>
                  <p className="section-surface-subtitle">
                    Отметьте все пункты, чтобы подтвердить, что результат действительно прошёл проверку.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="page-chip">
                  {completedProtocolItems}/{reviewProtocol.items.length} выполнено
                </span>
                {canRemoveReviewProtocol && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowReviewProtocolRemoveConfirm(true)}
                    disabled={detachReviewProtocolMutation.isPending}
                  >
                    <Unlink2 className="w-4 h-4" />
                    Убрать
                  </button>
                )}
                {canManageReviewProtocol && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowReviewProtocolSidebar(true)}
                  >
                    <ClipboardList className="w-4 h-4" />
                    Управлять протоколом
                  </button>
                )}
              </div>
            </div>
            <div className="card-body">
              <div className="space-y-3">
                {reviewProtocol.description && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                    {reviewProtocol.description}
                  </div>
                )}

                {reviewProtocol.items.map((item: any) => (
                  <label
                    key={item.id}
                    className={`flex items-start gap-3 rounded-2xl border px-4 py-4 transition ${
                      item.isChecked
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-slate-200 bg-white'
                    } ${canReviewCard || isAdmin ? 'cursor-pointer' : ''}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                      checked={item.isChecked}
                      disabled={!(canReviewCard || isAdmin) || toggleReviewProtocolItemMutation.isPending}
                      onChange={() => toggleReviewProtocolItemMutation.mutate(item.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-slate-800">{item.text}</div>
                      {item.isChecked && (
                        <div className="mt-2 text-xs text-emerald-700">
                          Отметил: {displayUserName(item.checkedBy, user?.id)}{item.checkedAt ? ` · ${formatRelative(item.checkedAt)}` : ''}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Source materials */}
        {!(card.withoutSourceMaterials && card.sourceMaterials?.length === 0) && (
        <div className="section-surface">
          <div className="section-surface-header">
            <div className="flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-gray-500" />
              <div>
                <h2 className="section-surface-title">
                  Исходные материалы
                  {card.sourceMaterials?.length > 0 && (
                    <span className="text-gray-400 font-normal ml-1">
                      ({card.sourceMaterials.length})
                    </span>
                  )}
                </h2>
                <p className="section-surface-subtitle">Файлы и ссылки, на которых основана работа по карточке.</p>
              </div>
            </div>
            {canEditWorkingCard && (
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
                          <button
                            type="button"
                            onClick={() => handleDownloadMaterial(mat.id, mat.title || 'material-file')}
                            className="btn-ghost text-xs"
                          >
                            <Download className="w-3 h-3" />
                            Скачать
                          </button>
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
                  <button
                    type="button"
                    onClick={handleDownloadAllMaterials}
                    className="btn-secondary text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Скачать все файлы (ZIP)
                  </button>
                </div>
              )}
          </div>
        </div>
        )}

        {/* Results with versioning */}
        {!shouldHideResultsSection && (
        <div className="section-surface">
          <div className="section-surface-header">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-500" />
              <div>
                <h2 className="section-surface-title">
                  Результаты
                  {card.resultVersions?.length > 0 && (
                    <span className="text-gray-400 font-normal ml-1">
                      (v{card.resultVersions.length})
                    </span>
                  )}
                </h2>
                <p className="section-surface-subtitle">Версии итоговых файлов и внешних ссылок по карточке.</p>
              </div>
            </div>
            {canEditWorkingCard && (
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
            {card.withoutResult && (
              <div className="section-muted-banner mb-4">
                <div>
                  <div className="section-muted-title">Карточка помечена как «без результата»</div>
                  <p className="section-muted-text">
                    Результат при отправке на проверку здесь необязателен, но его всё равно можно загрузить, если он появится.
                  </p>
                </div>
              </div>
            )}

            {card.resultVersions?.length === 0 ? (
              <p className="text-sm text-gray-400">Результаты ещё не загружены</p>
            ) : (
              <div className="space-y-4">
                {currentVersion && renderResultVersion(currentVersion)}

                {previousVersions.length > 0 && (
                  <div className="border border-slate-200 rounded-xl bg-slate-50/70 overflow-hidden">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-100/70 transition-colors"
                      onClick={() => setShowPreviousResults((value) => !value)}
                    >
                      <div>
                        <div className="text-sm font-medium text-slate-700">Предыдущие результаты</div>
                        <div className="text-xs text-gray-500">
                          Скрыто версий: {previousVersions.length}
                        </div>
                      </div>
                      {showPreviousResults ? (
                        <ChevronUp className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      )}
                    </button>

                    {showPreviousResults && (
                      <div className="p-4 pt-0 space-y-3">
                        {previousVersions.map((version: any) => renderResultVersion(version, true))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        )}

        {!!linkedInstructions?.length && (
          <div className="section-surface">
            <div className="section-surface-header">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-gray-500" />
                <div>
                  <h2 className="section-surface-title">
                    Инструкции
                    <span className="text-gray-400 font-normal ml-1">({linkedInstructions.length})</span>
                  </h2>
                  <p className="section-surface-subtitle">
                    Инструкции, которые вложены в эту карточку.
                  </p>
                </div>
              </div>
              {canManageInstructionLinks && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowInstructionsSidebar(true)}
                >
                  <BookOpen className="w-4 h-4" />
                  Управлять инструкциями
                </button>
              )}
            </div>
            <div className="card-body">
              <div className="space-y-3">
                {linkedInstructions.map((link: any) => (
                  <div
                    key={link.id}
                    className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 lg:flex-row lg:items-start lg:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="page-chip font-mono">{link.instruction.publicId}</span>
                        {link.instruction.folder && (
                          <span className="page-chip">{link.instruction.folder.name}</span>
                        )}
                        <span className="text-xs text-slate-400">
                          {formatRelative(link.createdAt)}
                        </span>
                      </div>
                      <div className="mt-3 text-base font-semibold text-slate-900">
                        {link.instruction.title}
                      </div>
                      {link.instruction.summary && (
                        <p className="mt-1 text-sm text-slate-500">{link.instruction.summary}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/instructions/${link.instruction.publicId}`}
                        target="_blank"
                        className="btn-secondary"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Открыть
                      </Link>
                      {canDetachInstructionLinks && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => detachInstructionMutation.mutate(link.instruction.id)}
                          disabled={detachInstructionMutation.isPending}
                        >
                          <Unlink2 className="w-4 h-4" />
                          Убрать
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {!!linkedComponents?.length && (
          <div className="section-surface">
            <div className="section-surface-header">
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-gray-500" />
                <div>
                  <h2 className="section-surface-title">
                    Компоненты
                    <span className="text-gray-400 font-normal ml-1">({linkedComponents.length})</span>
                  </h2>
                  <p className="section-surface-subtitle">
                    Инструменты и скрипты, которые используются для обработки данных по этой карточке.
                  </p>
                </div>
              </div>
              {canManageComponentLinks && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowComponentsSidebar(true)}
                >
                  <Boxes className="w-4 h-4" />
                  Управлять компонентами
                </button>
              )}
            </div>
            <div className="card-body">
              <div className="space-y-3">
                {linkedComponents.map((link: any) => (
                  <div
                    key={link.id}
                    className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 lg:flex-row lg:items-start lg:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div
                        role="button"
                        tabIndex={0}
                        className="rounded-xl text-left transition hover:bg-white/70 focus:outline-none focus:ring-2 focus:ring-primary-700/20"
                        onClick={() => setSelectedComponentRef(link.component.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedComponentRef(link.component.id);
                          }
                        }}
                      >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="page-chip font-mono">{link.component.publicId}</span>
                        <span className="text-xs text-slate-400">{formatRelative(link.createdAt)}</span>
                      </div>
                      <div className="mt-3 text-sm font-semibold text-slate-900">{link.component.name}</div>
                      {link.component.description && (
                        <p className="mt-1 text-sm text-slate-500">{link.component.description}</p>
                      )}
                      </div>
                      <div className="mt-3">
                        <ComponentLocationActions location={link.component.location} />
                      </div>
                    </div>

                    {canDetachComponentLinks && (
                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => detachComponentMutation.mutate(link.component.id)}
                          disabled={detachComponentMutation.isPending}
                        >
                          <Unlink2 className="w-4 h-4" />
                          Убрать
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {selectedComponentRef && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedComponentRef(null)} />
            <div className="relative mx-4 w-full max-w-2xl rounded-2xl bg-white shadow-xl">
              <div className="border-b border-slate-200 px-6 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="page-kicker">Компонент</div>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">
                      {isComponentLoading
                        ? 'Загрузка компонента...'
                        : selectedComponent?.name || selectedComponentRef}
                    </h3>
                    {!isComponentLoading && selectedComponent?.publicId && (
                      <div className="mt-1 font-mono text-xs text-slate-400">{selectedComponent.publicId}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn-icon h-10 w-10 border border-slate-200 bg-white text-slate-500"
                    onClick={() => setSelectedComponentRef(null)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="px-6 py-5">
                {isComponentLoading ? (
                  <div className="space-y-3">
                    <div className="skeleton h-16 rounded-2xl" />
                    <div className="skeleton h-12 rounded-2xl" />
                    <div className="skeleton h-12 rounded-2xl" />
                  </div>
                ) : isComponentError || !selectedComponent ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    Компонент не найден или недоступен для просмотра.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Описание
                      </div>
                      <div className="mt-2 text-sm text-slate-700">
                        {selectedComponent.description || 'Описание не заполнено.'}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Расположение
                      </div>
                      <div className="mt-3">
                        <ComponentLocationActions location={selectedComponent.location} />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Link href="/components" className="btn-secondary" onClick={() => setSelectedComponentRef(null)}>
                        <Boxes className="h-4 w-4" />
                        Открыть раздел компонентов
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Comments */}
        {showCommentsSection && (
          <div className="section-surface">
            <div className="section-surface-header">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-gray-500" />
                <div>
                  <h2 className="section-surface-title">
                    {isInformationalCard ? 'Комментарии' : 'Комментарии проверки'}
                    {card.comments?.length > 0 && (
                      <span className="text-gray-400 font-normal ml-1">({card.comments.length})</span>
                    )}
                  </h2>
                  <p className="section-surface-subtitle">
                    {isInformationalCard
                      ? 'Обсуждение, пояснения и рабочие заметки по информационной карточке.'
                      : 'Замечания и согласования по текущим версиям результата.'}
                  </p>
                </div>
              </div>
            </div>
            <div className="card-body">
              {/* New comment */}
              {canAddInlineComment && (
                <div className="mb-4">
                  <textarea
                    className="input min-h-20 resize-none"
                    placeholder={isInformationalCard ? 'Добавить комментарий или пояснение...' : 'Добавить комментарий...'}
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                  />
                  <button
                    className="btn-primary text-sm mt-2"
                    disabled={!newComment.trim() || commentMutation.isPending}
                    onClick={() => commentMutation.mutate(newComment)}
                  >
                    {isInformationalCard ? 'Добавить комментарий' : 'Отправить комментарий'}
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
                          {displayUserName(comment.author, user?.id)}
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
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">
                        <MentionText text={comment.text} />
                      </p>
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
          <div className="absolute inset-0 bg-black/40" onClick={closeStatusDialog} />
          <div className="relative bg-white rounded-sm shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-base font-semibold mb-4">
              {pendingStatus === 'CANCELLED' ? 'Отмена карточки' :
               pendingStatus === 'IN_PROGRESS' && card.status === 'REVIEW' ? 'Возврат с замечаниями' :
               pendingStatus === 'DONE' ? 'Подтверждение готовности' :
               'Изменение статуса'}
            </h3>

            {pendingStatus === 'CANCELLED' && (
              <div className="mb-4 space-y-4">
                <div>
                  <label className={`label ${isAdmin ? '' : 'label-required'}`}>Причина отмены</label>
                  <MentionTextarea
                    placeholder={isAdmin ? 'Причина отмены (необязательно)...' : 'Опишите причину отмены карточки...'}
                    value={statusReason}
                    onChange={setStatusReason}
                    minHeightClass="min-h-20"
                  />
                </div>
                <div>
                  <label className="label">Комментарий</label>
                  <MentionTextarea
                    placeholder="Дополнительный комментарий к отмене (необязательно)..."
                    value={statusComment}
                    onChange={setStatusComment}
                    minHeightClass="min-h-20"
                  />
                </div>
              </div>
            )}

              {pendingStatus === 'IN_PROGRESS' && card.status === 'REVIEW' && (
                <div className="mb-4">
                  <label className={`label ${isAdmin ? '' : 'label-required'}`}>Замечания</label>
                  <MentionTextarea
                    placeholder={
                      isAdmin
                        ? 'Комментарий к возврату (необязательно)...'
                        : hasUncheckedReviewProtocolItems
                        ? 'Можете добавить общий комментарий. Непройденные пункты протокола будут подставлены автоматически.'
                        : 'Опишите обнаруженные ошибки или замечания...'
                    }
                    value={statusComment}
                    onChange={setStatusComment}
                    minHeightClass="min-h-24"
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

            {!(pendingStatus === 'CANCELLED' || (pendingStatus === 'IN_PROGRESS' && card.status === 'REVIEW')) && (
              <div className="mb-4">
                <label className="label">Комментарий</label>
                <MentionTextarea
                  placeholder="Комментарий к изменению статуса (необязательно)..."
                  value={statusComment}
                  onChange={setStatusComment}
                  minHeightClass="min-h-20"
                />
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                className="btn-secondary"
                onClick={closeStatusDialog}
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

        <CardInstructionsSidebar
          cardId={id}
          isOpen={showInstructionsSidebar}
          onClose={() => setShowInstructionsSidebar(false)}
          linkedInstructions={linkedInstructions || []}
          canManage={canManageInstructionLinks}
          canDetach={canDetachInstructionLinks}
        />
        <CardComponentsSidebar
          cardId={id}
          isOpen={showComponentsSidebar}
          onClose={() => setShowComponentsSidebar(false)}
          linkedComponents={linkedComponents || []}
          canManage={canManageComponentLinks}
          canDetach={canDetachComponentLinks}
        />
        <CardReviewProtocolSidebar
          cardId={id}
          isOpen={showReviewProtocolSidebar}
        onClose={() => setShowReviewProtocolSidebar(false)}
        protocol={reviewProtocol}
          canManage={canManageReviewProtocol}
        />

        <ConfirmDialog
          isOpen={showReviewProtocolRemoveConfirm}
          title="Убрать протокол проверки?"
          description="Вы точно хотите убрать протокол проверки из карточки?"
          confirmLabel="Убрать"
          variant="warning"
          loading={detachReviewProtocolMutation.isPending}
          onCancel={() => setShowReviewProtocolRemoveConfirm(false)}
          onConfirm={() => {
            detachReviewProtocolMutation.mutate();
            setShowReviewProtocolRemoveConfirm(false);
          }}
        />

        <ConfirmDialog
          isOpen={showCloseCardNowConfirm}
          title="Закрыть карточку сейчас?"
          description="Все пункты протокола пройдены. Перевести карточку сразу в статус «Готово»?"
          confirmLabel="Закрыть карточку"
          variant="warning"
          loading={statusMutation.isPending}
          onCancel={() => setShowCloseCardNowConfirm(false)}
          onConfirm={() => {
            setShowCloseCardNowConfirm(false);
            statusMutation.mutate({
              status: 'DONE',
              force: isAdmin,
            });
          }}
        />
      </AppLayout>
    );
  }
