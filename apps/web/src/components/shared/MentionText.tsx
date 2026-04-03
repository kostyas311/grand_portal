'use client';

import { Fragment } from 'react';
import { TEXT_MENTION_REGEX } from '@/lib/mentions';

const PLAIN_MENTION_REGEX =
  /@([A-ZА-ЯЁ][\p{L}-]+(?:\s+[A-ZА-ЯЁ][\p{L}-]+){0,2})/gu;

export function MentionText({
  text,
  className,
}: {
  text?: string | null;
  className?: string;
}) {
  const value = (text || '').replaceAll('&nbsp;', ' ');
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
      value: (match[1] || match[3] || '').trim(),
      id: (match[2] || match[4] || '').trim(),
    });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < value.length) {
    parts.push({ type: 'text', value: value.slice(lastIndex) });
  }

  TEXT_MENTION_REGEX.lastIndex = 0;

  const renderTextWithPlainMentions = (segment: string, partIndex: number) => {
    const nodes: React.ReactNode[] = [];
    let plainLastIndex = 0;
    let plainMatch: RegExpExecArray | null;

    while ((plainMatch = PLAIN_MENTION_REGEX.exec(segment)) !== null) {
      const index = plainMatch.index ?? 0;
      if (index > plainLastIndex) {
        nodes.push(
          <Fragment key={`plain-text-${partIndex}-${plainLastIndex}`}>
            {segment.slice(plainLastIndex, index)}
          </Fragment>,
        );
      }

      nodes.push(
        <span key={`plain-mention-${partIndex}-${index}`} className="mention-inline">
          @{plainMatch[1]}
        </span>,
      );
      plainLastIndex = index + plainMatch[0].length;
    }

    if (plainLastIndex < segment.length) {
      nodes.push(
        <Fragment key={`plain-tail-${partIndex}-${plainLastIndex}`}>
          {segment.slice(plainLastIndex)}
        </Fragment>,
      );
    }

    PLAIN_MENTION_REGEX.lastIndex = 0;
    return nodes.length > 0 ? nodes : segment;
  };

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

        return (
          <Fragment key={`text-${index}`}>
            {renderTextWithPlainMentions(part.value, index)}
          </Fragment>
        );
      })}
    </span>
  );
}
