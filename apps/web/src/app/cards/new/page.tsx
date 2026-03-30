'use client';

import { useState, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Loader2, AlertTriangle, Plus, Paperclip, Link as LinkIcon, X, FileText, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { cardsApi, dataSourcesApi, usersApi, materialsApi } from '@/lib/api';
import { getMonthName } from '@/lib/utils';
import { useAuthStore } from '@/lib/store/auth.store';
import type { User } from '@/lib/store/auth.store';

const schema = z.object({
  dataSourceId: z.string().optional(),
  extraTitle: z.string().min(1, 'Введите наименование').max(255),
  month: z.number().min(1).max(12),
  year: z.number().min(2000).max(2100),
  description: z.string().optional(),
  priority: z.enum(['OPTIONAL', 'NORMAL', 'URGENT', 'CRITICAL']),
  dueDate: z.string().optional(),
  executorId: z.string().min(1, 'Выберите исполнителя'),
  reviewerId: z.string().optional(),
  parentId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

type PendingFile = { kind: 'file'; file: File; title: string; description: string };
type PendingLink = { kind: 'link'; url: string; title: string; description: string };
type PendingMaterial = PendingFile | PendingLink;

function getDueDateByPriority(priority: string): string {
  const d = new Date();
  if (priority === 'CRITICAL') { /* today */ }
  else if (priority === 'URGENT') d.setDate(d.getDate() + 1);
  else if (priority === 'NORMAL') d.setDate(d.getDate() + 7);
  else if (priority === 'OPTIONAL') d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

function NewCardForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const parentIdFromUrl = searchParams.get('parentId') || undefined;

  const [materials, setMaterials] = useState<PendingMaterial[]>([]);
  const [addMode, setAddMode] = useState<'file' | 'link' | null>(null);
  const [matFile, setMatFile] = useState<File | null>(null);
  const [matTitle, setMatTitle] = useState('');
  const [matDescription, setMatDescription] = useState('');
  const [matUrl, setMatUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [materialsError, setMaterialsError] = useState(false);

  const { data: sources } = useQuery({
    queryKey: ['data-sources'],
    queryFn: () => dataSourcesApi.getAll(),
  });

  const { data: users } = useQuery({
    queryKey: ['users-directory'],
    queryFn: () => usersApi.getDirectory(),
  });

  const { data: parentCard } = useQuery({
    queryKey: ['card', parentIdFromUrl],
    queryFn: () => cardsApi.getById(parentIdFromUrl!),
    enabled: !!parentIdFromUrl,
  });

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      month: currentMonth,
      year: currentYear,
      priority: 'NORMAL',
      dueDate: getDueDateByPriority('NORMAL'),
      reviewerId: user?.id ?? '',
      parentId: parentIdFromUrl,
    },
  });

  useEffect(() => {
    if (parentCard?.dataSourceId) {
      setValue('dataSourceId', parentCard.dataSourceId);
    }
  }, [parentCard?.dataSourceId]);

  const handlePriorityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const p = e.target.value;
    setValue('priority', p as any);
    setValue('dueDate', getDueDateByPriority(p));
  };

  const handleAddMaterial = () => {
    if (addMode === 'file') {
      if (!matFile) { toast.error('Выберите файл'); return; }
      setMaterials(p => [...p, { kind: 'file', file: matFile, title: matTitle, description: matDescription }]);
    } else {
      if (!matUrl.trim()) { toast.error('Введите URL'); return; }
      setMaterials(p => [...p, { kind: 'link', url: matUrl, title: matTitle, description: matDescription }]);
    }
    setAddMode(null);
    setMatFile(null); setMatTitle(''); setMatDescription(''); setMatUrl('');
    setMaterialsError(false);
  };

  const onSubmit = async (data: FormData) => {
    if (materials.length === 0) { setMaterialsError(true); return; }
    setSubmitting(true);
    try {
      const card = await cardsApi.create({ ...data, parentId: parentIdFromUrl });
      for (const mat of materials) {
        const fd = new FormData();
        if (mat.kind === 'file') {
          fd.append('materialType', 'FILE');
          fd.append('file', mat.file);
          if (mat.title) fd.append('title', mat.title);
          if (mat.description) fd.append('description', mat.description);
        } else {
          fd.append('materialType', 'EXTERNAL_LINK');
          fd.append('externalUrl', mat.url);
          fd.append('title', mat.title || mat.url);
          if (mat.description) fd.append('description', mat.description);
        }
        await materialsApi.add(card.id, fd);
      }
      toast.success('Карточка создана');
      queryClient.invalidateQueries({ queryKey: ['dashboard-cards'] });
      queryClient.invalidateQueries({ queryKey: ['all-cards'] });
      if (parentIdFromUrl) {
        queryClient.invalidateQueries({ queryKey: ['card', parentIdFromUrl] });
        router.push(`/cards/${parentIdFromUrl}`);
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Ошибка создания карточки');
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="page-container max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Link href={parentIdFromUrl ? `/cards/${parentIdFromUrl}` : '/dashboard'} className="btn-ghost">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="section-title">Создание карточки</h1>
            {parentIdFromUrl && (
              <p className="text-sm text-gray-500 mt-0.5">
                Дочерняя карточка для{' '}
                <Link href={`/cards/${parentCard?.publicId ?? parentIdFromUrl}`} className="text-primary hover:underline">
                  {parentCard
                    ? `${parentCard.publicId} — ${parentCard.dataSource?.name ?? parentCard.extraTitle ?? '—'}`
                    : '...'}
                </Link>
              </p>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Основные данные */}
          <div className="card">
            <div className="card-header">
              <h2 className="font-medium text-gray-700">Основные данные</h2>
            </div>
            <div className="card-body space-y-4">
              <div>
                <label className="label">
                  Источник данных
                  <span className="text-gray-400 font-normal ml-1">(необязательно)</span>
                </label>
                <select className="input" {...register('dataSourceId')}>
                  <option value="">— Одноразовый / не из справочника —</option>
                  {sources?.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {!watch('dataSourceId') && (
                  <div className="flex items-start gap-2 mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-sm text-sm text-amber-700">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>
                      Источник не выбран.
                      {user?.role === 'ADMIN' ? (
                        <> Если источник повторяющийся —{' '}
                          <Link href="/sources" className="underline font-medium">
                            внесите его в справочник
                          </Link>.
                        </>
                      ) : (
                        <> Если нужного источника нет — обратитесь к администратору.</>
                      )}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="label label-required">Наименование</label>
                <input
                  type="text"
                  className={`input ${errors.extraTitle ? 'input-error' : ''}`}
                  placeholder="Например: 1 квартал 2026"
                  {...register('extraTitle')}
                />
                {errors.extraTitle && <p className="error-message">{errors.extraTitle.message}</p>}
              </div>

              <input type="hidden" {...register('month', { valueAsNumber: true })} value={currentMonth} />
              <input type="hidden" {...register('year', { valueAsNumber: true })} value={currentYear} />

              <div>
                <label className="label">Краткое описание</label>
                <textarea
                  className="input min-h-20 resize-none"
                  placeholder="Описание задачи и особенностей..."
                  {...register('description')}
                />
              </div>
            </div>
          </div>

          {/* Исходные материалы */}
          <div className={`card ${materialsError ? 'ring-1 ring-red-400' : ''}`}>
            <div className="card-header">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-gray-500" />
                <h2 className="font-medium text-gray-700">
                  Исходные материалы
                  <span className="text-red-500 ml-1">*</span>
                </h2>
              </div>
              {addMode === null && (
                <div className="flex gap-2">
                  <button type="button" className="btn-secondary text-sm" onClick={() => setAddMode('file')}>
                    <FileText className="w-4 h-4" />
                    Файл
                  </button>
                  <button type="button" className="btn-secondary text-sm" onClick={() => setAddMode('link')}>
                    <LinkIcon className="w-4 h-4" />
                    Ссылка
                  </button>
                </div>
              )}
            </div>
            <div className="card-body space-y-3">
              {/* Форма добавления */}
              {addMode !== null && (
                <div className="border border-gray-200 rounded-sm p-4 space-y-3 bg-gray-50">
                  <div className="text-sm font-medium text-gray-700">
                    {addMode === 'file' ? 'Добавить файл' : 'Добавить ссылку'}
                  </div>
                  {addMode === 'file' ? (
                    <div>
                      <label className="label label-required">Файл</label>
                      <input
                        type="file"
                        className="input"
                        onChange={e => setMatFile(e.target.files?.[0] ?? null)}
                      />
                    </div>
                  ) : (
                    <div>
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
                  <div>
                    <label className="label">Название</label>
                    <input
                      type="text"
                      className="input"
                      placeholder={addMode === 'file' ? 'Оставьте пустым — будет имя файла' : 'Название ссылки'}
                      value={matTitle}
                      onChange={e => setMatTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Описание</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Необязательно"
                      value={matDescription}
                      onChange={e => setMatDescription(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="btn-primary text-sm" onClick={handleAddMaterial}>
                      <Plus className="w-4 h-4" />
                      Добавить
                    </button>
                    <button type="button" className="btn-secondary text-sm" onClick={() => { setAddMode(null); setMatFile(null); setMatTitle(''); setMatDescription(''); setMatUrl(''); }}>
                      Отмена
                    </button>
                  </div>
                </div>
              )}

              {/* Список добавленных */}
              {materials.length === 0 ? (
                <p className={`text-sm ${materialsError ? 'text-red-500' : 'text-gray-400'}`}>
                  {materialsError ? 'Необходимо добавить хотя бы один исходный материал' : 'Материалы не добавлены'}
                </p>
              ) : (
                <div className="space-y-2">
                  {materials.map((mat, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {mat.kind === 'file'
                          ? <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                          : <ExternalLink className="w-4 h-4 text-green-400 flex-shrink-0" />
                        }
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-700 truncate">
                            {mat.title || (mat.kind === 'file' ? mat.file.name : mat.url)}
                          </div>
                          {mat.description && (
                            <div className="text-xs text-gray-400 truncate">{mat.description}</div>
                          )}
                          {mat.kind === 'file' && (
                            <div className="text-xs text-gray-400">{mat.file.name}</div>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-icon text-gray-400 hover:text-red-500"
                        onClick={() => setMaterials(p => p.filter((_, j) => j !== i))}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Параметры и назначения */}
          <div className="card">
            <div className="card-header">
              <h2 className="font-medium text-gray-700">Параметры и назначения</h2>
            </div>
            <div className="card-body space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Приоритет</label>
                  <select className="input" {...register('priority')} onChange={handlePriorityChange}>
                    <option value="OPTIONAL">Желательно</option>
                    <option value="NORMAL">В рабочем режиме</option>
                    <option value="URGENT">Срочно</option>
                    <option value="CRITICAL">Очень срочно</option>
                  </select>
                </div>
                <div>
                  <label className="label">Срок исполнения</label>
                  <input type="date" className="input" {...register('dueDate')} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label label-required">Исполнитель</label>
                  <select className={`input ${errors.executorId ? 'input-error' : ''}`} {...register('executorId')}>
                    <option value="">— Выберите исполнителя —</option>
                    {users?.map((u: any) => (
                      <option key={u.id} value={u.id}>{u.fullName}</option>
                    ))}
                  </select>
                  {errors.executorId && <p className="error-message">{errors.executorId.message}</p>}
                </div>
                <div>
                  <label className="label">Проверяющий</label>
                  <select className="input" {...register('reviewerId')}>
                    <option value="">— Не назначен —</option>
                    {users?.map((u: any) => (
                      <option key={u.id} value={u.id}>{u.fullName}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Link href={parentIdFromUrl ? `/cards/${parentIdFromUrl}` : '/dashboard'} className="btn-secondary">Отмена</Link>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Создание...
                </>
              ) : (
                'Создать карточку'
              )}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

export default function NewCardPage() {
  return (
    <Suspense>
      <NewCardForm />
    </Suspense>
  );
}
