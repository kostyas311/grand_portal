'use client';

import { Check, Copy, ExternalLink, Folder } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn, isLocalPath, toFileUrl } from '@/lib/utils';

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export function ComponentLocationActions({
  location,
  className,
  compact = false,
}: {
  location: string;
  className?: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const local = isLocalPath(location);
  const external = isHttpUrl(location);
  const openHref = local ? toFileUrl(location) : external ? location : null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(location);
      setCopied(true);
      toast.success(local ? 'Путь скопирован' : 'Расположение скопировано');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Не удалось скопировать');
    }
  };

  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      {!compact && (
        <div className="flex min-w-0 items-center gap-2">
          {local ? (
            <Folder className="h-4 w-4 flex-shrink-0 text-amber-500" />
          ) : (
            <ExternalLink className="h-4 w-4 flex-shrink-0 text-slate-400" />
          )}
          <span className="truncate text-sm text-slate-600" title={location}>
            {location}
          </span>
        </div>
      )}

      <div className="flex items-center gap-1">
        <button
          type="button"
          className="btn-icon h-8 w-8"
          onClick={(event) => {
            event.stopPropagation();
            handleCopy();
          }}
          title="Скопировать"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        </button>

        {openHref && (
          <a
            href={openHref}
            target={local ? undefined : '_blank'}
            rel={local ? undefined : 'noopener noreferrer'}
            className="btn-icon h-8 w-8"
            onClick={(event) => event.stopPropagation()}
            title={local ? 'Открыть расположение' : 'Перейти по ссылке'}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
    </div>
  );
}
