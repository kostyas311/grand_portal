'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Archive, ArchiveRestore, GripVertical, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { reviewProtocolsApi, type ReviewProtocol } from '@/lib/api/reviewProtocols';
import { useAuthStore } from '@/lib/store/auth.store';

type EditorItem = {
  id: string;
  text: string;
};

export function ReviewProtocolEditor({ protocol }: { protocol?: ReviewProtocol | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [title, setTitle] = useState(protocol?.title || '');
  const [description, setDescription] = useState(protocol?.description || '');
  const [items, setItems] = useState<EditorItem[]>(
    protocol?.items?.map((item) => ({ id: item.id, text: item.text })) || [{ id: crypto.randomUUID(), text: '' }],
  );

  const normalizedItems = useMemo(
    () => items.map((item, index) => ({ text: item.text.trim(), sortOrder: index })).filter((item) => item.text),
    [items],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        items: normalizedItems,
      };

      if (protocol) {
        return reviewProtocolsApi.update(protocol.id, payload);
      }

      return reviewProtocolsApi.create(payload);
    },
    onSuccess: async (saved) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['review-protocols'] }),
        queryClient.invalidateQueries({ queryKey: ['review-protocol', saved.id] }),
      ]);
      toast.success(protocol ? 'Протокол сохранён' : 'Протокол создан');
      router.push(`/review-protocols/${saved.publicId}`);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Не удалось сохранить протокол'),
  });

  const archiveMutation = useMutation({
    mutationFn: () => reviewProtocolsApi.toggleArchive(protocol!.id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['review-protocols'] }),
        queryClient.invalidateQueries({ queryKey: ['review-protocol', protocol?.id] }),
      ]);
      toast.success(protocol?.isArchived ? 'Протокол восстановлен' : 'Протокол архивирован');
      router.refresh();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Не удалось изменить статус протокола'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => reviewProtocolsApi.delete(protocol!.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['review-protocols'] });
      toast.success('Протокол удалён');
      router.push('/review-protocols');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Не удалось удалить протокол'),
  });

  const addItem = () => {
    setItems((current) => [...current, { id: crypto.randomUUID(), text: '' }]);
  };

  const updateItem = (id: string, text: string) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, text } : item)));
  };

  const removeItem = (id: string) => {
    setItems((current) => {
      const next = current.filter((item) => item.id !== id);
      return next.length ? next : [{ id: crypto.randomUUID(), text: '' }];
    });
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    setItems((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const temp = next[index];
      next[index] = next[nextIndex];
      next[nextIndex] = temp;
      return next;
    });
  };

  return (
    <AppLayout>
      <div className="page-container max-w-5xl">
        <div className="page-hero">
          <div className="page-hero-body">
            <div className="page-title-row">
              <div>
                <div className="page-kicker">Протоколы проверки</div>
                <h1 className="section-title mt-2">{protocol ? 'Карточка протокола проверки' : 'Новый протокол проверки'}</h1>
                <p className="page-subtitle">
                  Протокол описывает обязательные шаги проверки результата и может копироваться в карточку или источник данных.
                </p>
                {protocol?.publicId && <div className="mt-3 text-sm font-mono text-slate-400">{protocol.publicId}</div>}
              </div>
              <div className="flex items-start">
                <Link href="/review-protocols" className="btn-ghost">
                  <ArrowLeft className="h-4 w-4" />
                  Назад
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="section-surface">
            <div className="section-surface-header">
              <div>
                <h2 className="section-surface-title">Основные данные</h2>
                <p className="section-surface-subtitle">Название и описание того, что именно должен проверить проверяющий.</p>
              </div>
            </div>
            <div className="card-body space-y-4">
              <div>
                <label className="label label-required">Название</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Например: Проверка результата по Росстату"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
              <div>
                <label className="label">Описание</label>
                <textarea
                  className="input min-h-24 resize-none"
                  placeholder="Когда используется этот протокол..."
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="section-surface">
            <div className="section-surface-header">
              <div>
                <h2 className="section-surface-title">Пункты проверки</h2>
                <p className="section-surface-subtitle">Каждый пункт будет отдельной галочкой в карточке на этапе проверки.</p>
              </div>
              <button type="button" className="btn-secondary" onClick={addItem}>
                <Plus className="h-4 w-4" />
                Добавить пункт
              </button>
            </div>
            <div className="card-body space-y-3">
              {items.map((item, index) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-2 rounded-xl bg-white p-2 text-slate-400 shadow-sm">
                      <GripVertical className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Пункт {index + 1}</div>
                      <textarea
                        className="input min-h-20 resize-none"
                        placeholder="Что именно нужно проверить?"
                        value={item.text}
                        onChange={(event) => updateItem(item.id, event.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <button type="button" className="btn-icon" onClick={() => moveItem(index, -1)} disabled={index === 0} title="Поднять выше">
                        ^
                      </button>
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => moveItem(index, 1)}
                        disabled={index === items.length - 1}
                        title="Опустить ниже"
                        >
                        v
                      </button>
                      <button type="button" className="btn-icon text-red-500 hover:bg-red-50" onClick={() => removeItem(item.id)} title="Удалить пункт">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="form-actions">
            <div className="flex flex-wrap items-center gap-3">
              {protocol && (
                <button type="button" className="btn-secondary" onClick={() => archiveMutation.mutate()} disabled={archiveMutation.isPending}>
                  {protocol.isArchived ? (
                    <>
                      <ArchiveRestore className="h-4 w-4" />
                      Восстановить
                    </>
                  ) : (
                    <>
                      <Archive className="h-4 w-4" />
                      Архивировать
                    </>
                  )}
                </button>
              )}
              {user?.role === 'ADMIN' && protocol && (
                <button type="button" className="btn-danger" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
                  <Trash2 className="h-4 w-4" />
                  Удалить
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link href="/review-protocols" className="btn-secondary">Отмена</Link>
              <button
                type="button"
                className="btn-primary"
                disabled={!title.trim() || normalizedItems.length === 0 || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Сохранение...
                  </>
                ) : protocol ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
