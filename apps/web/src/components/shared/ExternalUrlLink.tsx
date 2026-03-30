'use client';

import { useState } from 'react';
import { ExternalLink, Folder, Copy, Check } from 'lucide-react';
import { isLocalPath, toFileUrl } from '@/lib/utils';
import { toast } from 'sonner';

interface ExternalUrlLinkProps {
  url: string;
  title?: string;
  className?: string;
}

/**
 * Renders an external URL or a local file-system path.
 * For local paths (\\server\share, C:\folder): shows a copy button + file:// open attempt.
 * For regular URLs: opens in a new tab normally.
 */
export function ExternalUrlLink({ url, title, className = '' }: ExternalUrlLinkProps) {
  const [copied, setCopied] = useState(false);
  const local = isLocalPath(url);

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success('Путь скопирован');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (local) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`}>
        <Folder className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
        <span className="text-sm text-gray-700 font-mono text-xs break-all">{title || url}</span>
        <button
          onClick={handleCopy}
          className="flex-shrink-0 text-gray-400 hover:text-gray-700 transition-colors"
          title="Скопировать путь"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
        <a
          href={toFileUrl(url)}
          className="flex-shrink-0 text-xs text-primary hover:underline"
          title="Открыть в проводнике (браузер может заблокировать)"
        >
          Открыть
        </a>
      </span>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-primary hover:underline text-sm ${className}`}
    >
      <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
      {title || url}
    </a>
  );
}
