'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { InstructionStatusBadge } from './InstructionStatusBadge';
import { getAccessToken } from '@/lib/api';
import {
  InstructionAttachmentItem,
  InstructionItem,
  instructionsApi,
} from '@/lib/api/instructions';

const InstructionEditor = dynamic(
  () => import('./InstructionEditor').then((module) => module.InstructionEditor),
  {
    ssr: false,
    loading: () => <div className="skeleton h-[420px] rounded-2xl" />,
  },
);

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Черновик' },
  { value: 'PUBLISHED', label: 'Опубликовано' },
  { value: 'HIDDEN', label: 'Скрыто' },
  { value: 'ARCHIVED', label: 'Архивно' },
] as const;

type PendingInstructionFile = {
  key: string;
  file: File;
};

function createPendingFileKey(file: File) {
  return `pending-${file.name}-${file.size}-${file.lastModified}`;
}

function reconcilePendingAttachmentLinks(
  html: string,
  pendingFiles: PendingInstructionFile[],
  uploadedAttachments: InstructionAttachmentItem[],
  instructionId: string,
) {
  if (!html.trim() || !pendingFiles.length || !uploadedAttachments.length) {
    return html;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="root">${html}</div>`, 'text/html');
  const root = doc.getElementById('root');
  if (!root) {
    return html;
  }

  pendingFiles.forEach((pendingFile, index) => {
    const uploadedAttachment = uploadedAttachments[index];
    if (!uploadedAttachment) {
      return;
    }

    const selector = `[data-pending-attachment-key="${pendingFile.key}"]`;
    root.querySelectorAll(selector).forEach((element) => {
      if (!(element instanceof HTMLAnchorElement)) {
        return;
      }

      element.href = instructionsApi.downloadAttachmentUrl(instructionId, uploadedAttachment.id);
      element.target = '_blank';
      element.rel = 'noopener noreferrer';
      element.removeAttribute('data-pending-attachment-key');
      element.removeAttribute('class');
      element.textContent = uploadedAttachment.fileName;
    });
  });

  return root.innerHTML;
}

function stripMissingPendingAttachmentMarkers(html: string, pendingFiles: PendingInstructionFile[]) {
  if (!html.trim()) {
    return html;
  }

  const validKeys = new Set(pendingFiles.map((item) => item.key));
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="root">${html}</div>`, 'text/html');
  const root = doc.getElementById('root');
  if (!root) {
    return html;
  }

  root.querySelectorAll('[data-pending-attachment-key]').forEach((element) => {
    const key = element.getAttribute('data-pending-attachment-key');
    if (key && !validKeys.has(key)) {
      const replacement = doc.createTextNode(element.textContent || '');
      element.parentNode?.replaceChild(replacement, element);
    }
  });

  return root.innerHTML;
}

export function InstructionForm({
  mode,
  instruction,
}: {
  mode: 'create' | 'edit';
  instruction?: InstructionItem;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tokenReady, setTokenReady] = useState(() => !!getAccessToken());

  const [title, setTitle] = useState(instruction?.title || '');
  const [summary, setSummary] = useState(instruction?.summary || '');
  const [status, setStatus] = useState<InstructionItem['status']>(instruction?.status || 'DRAFT');
  const [folderId, setFolderId] = useState(instruction?.folder?.id || '');
  const [newFolderName, setNewFolderName] = useState('');
  const [contentHtml, setContentHtml] = useState(
    instruction?.contentHtml ||
      '<p>Опишите порядок действий, важные условия и ссылки на сопутствующие материалы.</p>',
  );
  const [pendingFiles, setPendingFiles] = useState<PendingInstructionFile[]>([]);

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

  const { data: folders } = useQuery({
    queryKey: ['instruction-folders'],
    queryFn: () => instructionsApi.getFolders(),
    enabled: tokenReady,
  });

  const appendPendingFiles = (files: File[]) => {
    const nextItems = files.map((file) => ({
      key: createPendingFileKey(file),
      file,
    }));

    const existingKeys = new Set(pendingFiles.map((item) => item.key));
    const uniqueItems = nextItems.filter((item) => !existingKeys.has(item.key));

    if (!uniqueItems.length) {
      return [];
    }

    setPendingFiles((current) => [...current, ...uniqueItems]);

    return uniqueItems.map((item) => ({
      key: item.key,
      fileName: item.file.name,
      pending: true,
    }));
  };

  const uploadPendingFiles = async (instructionId: string) => {
    if (!pendingFiles.length) {
      return [] as InstructionAttachmentItem[];
    }

    const formData = new FormData();
    pendingFiles.forEach((item) => formData.append('files', item.file));
    return instructionsApi.uploadAttachments(instructionId, formData);
  };

  const finalizeContentWithUploadedAttachments = async (instructionId: string) => {
    const uploadedAttachments = await uploadPendingFiles(instructionId);

    if (!uploadedAttachments.length) {
      return null;
    }

    const reconciledHtml = reconcilePendingAttachmentLinks(
      contentHtml,
      pendingFiles,
      uploadedAttachments,
      instructionId,
    );

    setPendingFiles([]);

    if (reconciledHtml !== contentHtml) {
      setContentHtml(reconciledHtml);
      return instructionsApi.update(instructionId, { contentHtml: reconciledHtml });
    }

    return null;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const normalizedHtml = stripMissingPendingAttachmentMarkers(contentHtml, pendingFiles);
      const created = await instructionsApi.create({
        title,
        summary,
        contentHtml: normalizedHtml,
        status,
        folderId: folderId || undefined,
        newFolderName: newFolderName || undefined,
      });
      if (normalizedHtml !== contentHtml) {
        setContentHtml(normalizedHtml);
      }
      const finalized = await finalizeContentWithUploadedAttachments(created.id);
      return finalized || created;
    },
    onSuccess: async (created) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['instructions'] }),
        queryClient.invalidateQueries({ queryKey: ['instruction-folders'] }),
        queryClient.invalidateQueries({ queryKey: ['published-instructions-picker'] }),
      ]);
      toast.success('Инструкция создана');
      router.push(`/instructions/${created.publicId}`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Не удалось создать инструкцию');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!instruction) return null;
      const normalizedHtml = stripMissingPendingAttachmentMarkers(contentHtml, pendingFiles);
      const updated = await instructionsApi.update(instruction.id, {
        title,
        summary,
        contentHtml: normalizedHtml,
        status,
        folderId: folderId || undefined,
        newFolderName: newFolderName || undefined,
      });
      if (normalizedHtml !== contentHtml) {
        setContentHtml(normalizedHtml);
      }
      const finalized = await finalizeContentWithUploadedAttachments(instruction.id);
      return finalized || updated;
    },
    onSuccess: async (updated) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['instructions'] }),
        queryClient.invalidateQueries({ queryKey: ['instruction-folders'] }),
        queryClient.invalidateQueries({ queryKey: ['instruction', instruction?.publicId || instruction?.id] }),
        queryClient.invalidateQueries({ queryKey: ['instruction', instruction?.id] }),
        queryClient.invalidateQueries({ queryKey: ['published-instructions-picker'] }),
      ]);
      toast.success('Инструкция сохранена');
      if (updated) {
        router.push(`/instructions/${updated.publicId}`);
      }
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Не удалось сохранить инструкцию');
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const currentStatusLabel = useMemo(
    () => STATUS_OPTIONS.find((item) => item.value === status)?.label || status,
    [status],
  );
  const editorAttachments = useMemo(
    () => [
      ...(instruction?.attachments?.map((attachment) => ({
        key: attachment.id,
        fileName: attachment.fileName,
        href: instructionsApi.downloadAttachmentUrl(instruction.id, attachment.id),
      })) || []),
      ...pendingFiles.map((item) => ({
        key: item.key,
        fileName: item.file.name,
        pending: true,
      })),
    ],
    [instruction, pendingFiles],
  );

  return (
    <div className="space-y-6">
      <div className="page-hero">
        <div className="page-hero-body">
          <div className="page-title-row">
            <div className="flex-1 min-w-0">
              <div className="page-kicker">Инструкции</div>
              <div className="page-chip-row mt-3">
                {instruction?.publicId && <span className="page-chip font-mono">{instruction.publicId}</span>}
                <InstructionStatusBadge status={status} />
              </div>
              <h1 className="mt-4 text-2xl font-semibold text-slate-900">
                {mode === 'create' ? 'Новая инструкция' : 'Редактирование инструкции'}
              </h1>
              <p className="page-subtitle">
                Статус сейчас: {currentStatusLabel}. Опубликованные инструкции видны всем пользователям, остальные — только автору и администратору.
              </p>
            </div>

            <div className="card-action-toolbar">
              {instruction && (
                <Link href={`/instructions/${instruction.publicId}`} className="toolbar-button toolbar-button-ghost">
                  Назад к инструкции
                </Link>
              )}
              <Link href="/instructions" className="toolbar-button toolbar-button-ghost">
                К списку
              </Link>
              <button
                type="button"
                className="toolbar-button toolbar-button-primary"
                onClick={() => (mode === 'create' ? createMutation.mutate() : updateMutation.mutate())}
                disabled={isSubmitting || !title.trim() || !contentHtml.trim()}
              >
                <Save className="h-4 w-4" />
                {isSubmitting ? 'Сохраняем...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="section-surface">
        <div className="section-surface-header">
          <div>
            <div className="section-surface-title">Основные сведения</div>
            <div className="section-surface-subtitle">Название, каталог и режим публикации.</div>
          </div>
        </div>
        <div className="card-body space-y-4">
          <div className="form-grid-2">
            <div>
              <label className="label label-required">Название инструкции</label>
              <input
                className="input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Например: Обработка входных XLSX-файлов"
              />
            </div>
            <div>
              <label className="label">Статус</label>
              <select className="input" value={status} onChange={(event) => setStatus(event.target.value as InstructionItem['status'])}>
                {STATUS_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-grid-2">
            <div>
              <label className="label">Каталог</label>
              <select className="input" value={folderId} onChange={(event) => setFolderId(event.target.value)}>
                <option value="">Без каталога</option>
                {(folders || []).map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Новый каталог</label>
              <input
                className="input"
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                placeholder="Если нужен новый каталог, укажи название"
              />
            </div>
          </div>

          <div>
            <label className="label">Краткое описание</label>
            <textarea
              className="input min-h-24 resize-none"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="Коротко опиши, что именно описывает эта инструкция"
            />
          </div>
        </div>
      </div>

      <div className="section-surface">
        <div className="section-surface-header">
          <div>
            <div className="section-surface-title">Содержимое</div>
            <div className="section-surface-subtitle">Форматирование максимально приближено к wiki-странице.</div>
          </div>
        </div>
        <div className="card-body">
          <InstructionEditor
            value={contentHtml}
            onChange={setContentHtml}
            attachments={editorAttachments}
            onAddPendingAttachments={appendPendingFiles}
          />
        </div>
      </div>
    </div>
  );
}
