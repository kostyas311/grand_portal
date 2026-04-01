'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Link2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { instructionsApi } from '@/lib/api/instructions';
import { formatRelative } from '@/lib/utils';

export function InstructionPickerDialog({
  cardId,
  isOpen,
  onClose,
}: {
  cardId: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: publishedInstructions } = useQuery({
    queryKey: ['published-instructions-picker'],
    queryFn: () => instructionsApi.getPublished(),
    enabled: isOpen,
  });

  const attachMutation = useMutation({
    mutationFn: (instructionId: string) => instructionsApi.attachToCard(cardId, instructionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['card-instructions', cardId] });
      toast.success('Инструкция вложена в карточку');
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Не удалось вложить инструкцию');
    },
  });

  const filtered = useMemo(() => {
    const items = publishedInstructions || [];
    if (!search.trim()) return items;
    const normalized = search.trim().toLowerCase();
    return items.filter((item) =>
      [item.title, item.summary || '', item.folder?.name || '', item.publicId]
        .join(' ')
        .toLowerCase()
        .includes(normalized),
    );
  }, [publishedInstructions, search]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative mx-4 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="text-lg font-semibold text-slate-900">Вложить инструкцию</div>
          <div className="mt-1 text-sm text-slate-500">
            Для карточки доступны только опубликованные инструкции.
          </div>
        </div>

        <div className="px-6 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Поиск по названию, каталогу или коду..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 pb-4">
          {!filtered.length ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center text-sm text-slate-500">
              Опубликованные инструкции не найдены.
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((instruction) => (
                <div key={instruction.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="page-chip font-mono">{instruction.publicId}</span>
                        {instruction.folder && <span className="page-chip">{instruction.folder.name}</span>}
                        <span className="text-xs text-slate-400">{formatRelative(instruction.updatedAt)}</span>
                      </div>
                      <div className="mt-3 text-base font-semibold text-slate-900">{instruction.title}</div>
                      {instruction.summary && (
                        <p className="mt-1 text-sm text-slate-500">{instruction.summary}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/instructions/${instruction.publicId}`} target="_blank" className="btn-secondary">
                        <ExternalLink className="h-4 w-4" />
                        Открыть
                      </Link>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => attachMutation.mutate(instruction.id)}
                        disabled={attachMutation.isPending}
                      >
                        <Link2 className="h-4 w-4" />
                        Вложить
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-200 px-6 py-4">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
