'use client';

import { useState } from 'react';
import { Link, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CopyLinkProps {
  url: string;
  className?: string;
  iconOnly?: boolean;
}

export function CopyLink({ url, className, iconOnly = false }: CopyLinkProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Ссылка скопирована');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Не удалось скопировать ссылку');
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={cn('btn-ghost text-sm', className)}
      title="Скопировать ссылку на карточку"
      aria-label={copied ? 'Ссылка скопирована' : 'Скопировать ссылку на карточку'}
    >
      {copied ? (
        <>
          <Check className="w-4 h-4 text-green-500" />
          {!iconOnly && <span className="text-green-600">Скопировано</span>}
        </>
      ) : (
        <>
          <Link className="w-4 h-4" />
          {!iconOnly && <span>Скопировать ссылку</span>}
        </>
      )}
    </button>
  );
}
