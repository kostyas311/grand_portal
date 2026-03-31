'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { cardsApi, dataSourcesApi, usersApi } from '@/lib/api';
import { getMonthName } from '@/lib/utils';
import { useEffect } from 'react';
import { CardStatusBadge } from '@/components/cards/CardStatusBadge';
import { CardPriorityBadge } from '@/components/cards/CardPriorityBadge';

const schema = z.object({
  dataSourceId: z.string().min(1),
  extraTitle: z.string().max(255).optional(),
  month: z.number().min(1).max(12),
  year: z.number().min(2000).max(2100),
  description: z.string().optional(),
  priority: z.enum(['OPTIONAL', 'NORMAL', 'URGENT', 'CRITICAL']),
  dueDate: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function EditCardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: card, isLoading } = useQuery({
    queryKey: ['card', id],
    queryFn: () => cardsApi.getById(id),
  });

  const { data: sources } = useQuery({
    queryKey: ['data-sources'],
    queryFn: () => dataSourcesApi.getAll(),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (card) {
      reset({
        dataSourceId: card.dataSourceId,
        extraTitle: card.extraTitle || '',
        month: card.month,
        year: card.year,
        description: card.description || '',
        priority: card.priority,
        dueDate: card.dueDate ? new Date(card.dueDate).toISOString().split('T')[0] : '',
      });
    }
  }, [card, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: FormData) => cardsApi.update(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['card', id] });
      toast.success('Карточка обновлена');
      router.push(`/cards/${updated.publicId}`);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Ошибка'),
  });

  if (isLoading || !card) {
    return (
      <AppLayout>
        <div className="page-container">
          <div className="skeleton h-96" />
        </div>
      </AppLayout>
    );
  }

  if (card.isLocked) {
    return (
      <AppLayout>
        <div className="page-container">
          <div className="card p-8 text-center text-gray-500">
            Карточка закрыта и не может быть отредактирована
          </div>
        </div>
      </AppLayout>
    );
  }

  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 1 + i);

  return (
    <AppLayout>
      <div className="page-container max-w-4xl">
        <div className="page-hero">
          <div className="page-hero-body">
            <div className="page-title-row">
              <div>
                <div className="page-kicker">Карточки</div>
                <h1 className="section-title mt-2">Редактирование карточки</h1>
                <p className="page-subtitle">
                  Изменения вносятся в рамках единой формы карточки и сразу сохраняют её текущий рабочий контекст.
                </p>
                <div className="page-chip-row">
                  <span className="page-chip font-mono">{card.publicId}</span>
                  <CardStatusBadge status={card.status} />
                  <CardPriorityBadge priority={card.priority} />
                  <span className="page-chip">{getMonthName(card.month)} {card.year}</span>
                </div>
              </div>
              <div className="flex items-start">
                <Link href={`/cards/${card.publicId}`} className="btn-ghost">
                  <ArrowLeft className="w-4 h-4" />
                  Назад
                </Link>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(data => updateMutation.mutate(data))} className="space-y-4">
          <div className="section-surface">
            <div className="section-surface-header">
              <div>
                <h2 className="section-surface-title">Основные данные</h2>
                <p className="section-surface-subtitle">Базовые реквизиты карточки и её описание.</p>
              </div>
            </div>
            <div className="card-body space-y-4">
              <div>
                <label className="label label-required">Источник данных</label>
                <select className={`input ${errors.dataSourceId ? 'input-error' : ''}`} {...register('dataSourceId')}>
                  {sources?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label className="label">Дополнительное название</label>
                <input type="text" className="input" {...register('extraTitle')} />
              </div>

              <div className="form-grid-2">
                <div>
                  <label className="label label-required">Месяц</label>
                  <select className="input" {...register('month', { valueAsNumber: true })}>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i+1} value={i+1}>{getMonthName(i+1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label label-required">Год</label>
                  <select className="input" {...register('year', { valueAsNumber: true })}>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Краткое описание</label>
                <textarea className="input min-h-20 resize-none" {...register('description')} />
              </div>
            </div>
          </div>

          <div className="section-surface">
            <div className="section-surface-header">
              <div>
                <h2 className="section-surface-title">Параметры</h2>
                <p className="section-surface-subtitle">Приоритет и срок исполнения для текущей версии карточки.</p>
              </div>
            </div>
            <div className="card-body space-y-4">
              <div className="form-grid-2">
                <div>
                  <label className="label">Приоритет</label>
                  <select className="input" {...register('priority')}>
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
            </div>
          </div>

          <div className="form-actions">
            <Link href={`/cards/${card.publicId}`} className="btn-secondary">Отмена</Link>
            <button type="submit" className="btn-primary" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Сохранение...</> : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
