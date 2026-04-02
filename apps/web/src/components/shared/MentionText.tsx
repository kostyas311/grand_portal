'use client';

import { Fragment } from 'react';
import { TEXT_MENTION_REGEX } from '@/lib/mentions';

export function MentionText({
  text,
  className,
}: {
  text?: string | null;
  className?: string;
}) {
  const value = text || '';
  const parts: Array<{ type: 'text' | 'mention'; value: string; id?: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TEXT_MENTION_REGEX.exec(value)) !== null) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ type: 'text', value: value.slice(lastIndex, index) });
    }

    parts.push({
      type: 'mention',
      value: match[1] || '',
      id: match[2] || '',
    });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < value.length) {
    parts.push({ type: 'text', value: value.slice(lastIndex) });
  }

  TEXT_MENTION_REGEX.lastIndex = 0;

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.type === 'mention') {
          return (
            <span key={`${part.id}-${index}`} className="mention-inline">
              @{part.value}
            </span>
          );
        }

        return <Fragment key={`text-${index}`}>{part.value}</Fragment>;
      })}
    </span>
  );
}
