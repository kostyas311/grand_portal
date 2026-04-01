'use client';

import { InstructionStatus } from '@/lib/api/instructions';
import { cn } from '@/lib/utils';

const META: Record<InstructionStatus, { label: string; className: string }> = {
  DRAFT: {
    label: 'Черновик',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  PUBLISHED: {
    label: 'Опубликовано',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  HIDDEN: {
    label: 'Скрыто',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  ARCHIVED: {
    label: 'Архивно',
    className: 'bg-violet-50 text-violet-700 border-violet-200',
  },
};

export function InstructionStatusBadge({ status }: { status: InstructionStatus }) {
  const meta = META[status];

  return (
    <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold', meta.className)}>
      {meta.label}
    </span>
  );
}
