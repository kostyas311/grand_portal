'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { usersApi } from '@/lib/api';
import type { User } from '@/lib/store/auth.store';
import {
  getMentionSuggestions,
  textMentionsToHtml,
  textWithMentionsFromEditable,
} from '@/lib/mentions';

type MentionState = {
  query: string;
  range: Range;
  textNode: Text;
  startOffset: number;
  endOffset: number;
  rect: DOMRect;
};

export function MentionTextarea({
  value,
  onChange,
  placeholder,
  className,
  minHeightClass = 'min-h-20',
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeightClass?: string;
  disabled?: boolean;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastRenderedValueRef = useRef(value);
  const [mentionState, setMentionState] = useState<MentionState | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['mentionable-users'],
    queryFn: () => usersApi.getDirectory(true),
    staleTime: 60_000,
  });

  const suggestions = useMemo(
    () => getMentionSuggestions(users, mentionState?.query || ''),
    [users, mentionState?.query],
  );

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    if (value === lastRenderedValueRef.current) {
      return;
    }

    const nextHtml = textMentionsToHtml(value);
    if (editor.innerHTML !== nextHtml) {
      editor.innerHTML = nextHtml;
    }

    lastRenderedValueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (activeIndex > suggestions.length - 1) {
      setActiveIndex(0);
    }
  }, [activeIndex, suggestions.length]);

  const syncValue = () => {
    if (!editorRef.current) {
      return;
    }

    const nextValue = textWithMentionsFromEditable(editorRef.current);
    lastRenderedValueRef.current = nextValue;
    onChange(nextValue);
  };

  const updateMentionQuery = () => {
    const selection = window.getSelection();
    const range =
      selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    if (!range || !range.collapsed) {
      setMentionState(null);
      return;
    }

    const textNode =
      range.startContainer.nodeType === Node.TEXT_NODE
        ? (range.startContainer as Text)
        : null;

    if (!textNode || !editorRef.current?.contains(textNode)) {
      setMentionState(null);
      return;
    }

    if ((textNode.parentElement?.closest('.mention-token') as HTMLElement | null) != null) {
      setMentionState(null);
      return;
    }

    const beforeCaret = textNode.data.slice(0, range.startOffset);
    const match = beforeCaret.match(/(^|\s)@([^\s@]*)$/);

    if (!match) {
      setMentionState(null);
      return;
    }

    const mentionText = match[0].startsWith('@') ? match[0] : match[0].slice(1);
    const startOffset = range.startOffset - mentionText.length;
    const rect = range.getBoundingClientRect();

    const nextQuery = match[2] || '';

    setMentionState((current) => {
      if (current?.query !== nextQuery) {
        setActiveIndex(0);
      }

      return {
        query: nextQuery,
        range: range.cloneRange(),
        textNode,
        startOffset,
        endOffset: range.startOffset,
        rect,
      };
    });
  };

  const placeCaretAfter = (node: Node, offset = 0) => {
    const selection = window.getSelection();
    if (!selection) {
      return;
    }

    const range = document.createRange();
    range.setStart(node, offset);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const insertMention = (user: User) => {
    if (!mentionState) {
      return;
    }

    const { textNode, startOffset, endOffset } = mentionState;
    const parent = textNode.parentNode;
    if (!parent) {
      return;
    }

    const before = textNode.data.slice(0, startOffset);
    const after = textNode.data.slice(endOffset);

    const beforeNode = before ? document.createTextNode(before) : null;
    const mentionNode = document.createElement('span');
    mentionNode.className = 'mention-token';
    mentionNode.setAttribute('contenteditable', 'false');
    mentionNode.dataset.mentionId = user.id;
    mentionNode.dataset.mentionName = user.fullName;
    mentionNode.textContent = `@${user.fullName}`;
    const trailingText = document.createTextNode(` ${after}`);

    if (beforeNode) {
      parent.insertBefore(beforeNode, textNode);
    }
    parent.insertBefore(mentionNode, textNode);
    parent.insertBefore(trailingText, textNode);
    parent.removeChild(textNode);

    placeCaretAfter(trailingText, 1);
    syncValue();
    setMentionState(null);
    editorRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (mentionState && suggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((current) => (current + 1) % suggestions.length);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
        return;
      }

      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        insertMention(suggestions[activeIndex] || suggestions[0]);
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setMentionState(null);
        return;
      }
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      document.execCommand('insertLineBreak');
      syncValue();
      updateMentionQuery();
    }
  };

  const handleKeyUp = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(event.key)) {
      return;
    }

    updateMentionQuery();
  };

  return (
    <div className="mention-input-shell">
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        className={cn('mention-input', minHeightClass, className, disabled && 'opacity-60')}
        onInput={() => {
          syncValue();
          updateMentionQuery();
        }}
        onKeyDown={handleKeyDown}
        onFocus={updateMentionQuery}
        onMouseUp={updateMentionQuery}
        onKeyUp={handleKeyUp}
        onBlur={() => {
          window.setTimeout(() => setMentionState(null), 100);
        }}
      />

      {mentionState && suggestions.length > 0 && (
        <div
          className="mention-suggestions"
          style={{
            top: Math.min(mentionState.rect.bottom + 8, window.innerHeight - 240),
            left: Math.min(
              Math.max(mentionState.rect.left, 16),
              window.innerWidth - 340,
            ),
          }}
        >
          {suggestions.map((user, index) => (
            <button
              key={user.id}
              type="button"
              className={cn('mention-suggestion-item', index === activeIndex && 'mention-suggestion-item-active')}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => insertMention(user)}
            >
              <div className="mention-suggestion-title">{user.fullName}</div>
              <div className="mention-suggestion-meta">{user.email}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
