'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { instructionsApi } from '@/lib/api/instructions';

export default function InstructionPrintPage() {
  const { id } = useParams<{ id: string }>();

  const { data: instruction } = useQuery({
    queryKey: ['instruction-print', id],
    queryFn: () => instructionsApi.getById(id),
  });

  useEffect(() => {
    if (!instruction) return;
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, [instruction]);

  if (!instruction) {
    return <div className="p-8 text-sm text-slate-500">Подготовка инструкции к печати...</div>;
  }

  return (
    <div className="mx-auto max-w-4xl bg-white px-10 py-10 text-slate-900">
      <div className="border-b border-slate-200 pb-6">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Портал "Нормбаза"</div>
        <h1 className="mt-3 text-3xl font-semibold">{instruction.title}</h1>
        {instruction.summary && <p className="mt-3 text-sm text-slate-500">{instruction.summary}</p>}
        <div className="mt-4 text-xs text-slate-500">
          {instruction.publicId} • {instruction.folder?.name || 'Без каталога'}
        </div>
      </div>

      <div className="instruction-prose mt-8" dangerouslySetInnerHTML={{ __html: instruction.contentHtml }} />

      {instruction.attachments.length > 0 && (
        <div className="mt-10 border-t border-slate-200 pt-6">
          <div className="text-sm font-semibold text-slate-900">Вложения</div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
            {instruction.attachments.map((attachment) => (
              <li key={attachment.id}>{attachment.fileName}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
