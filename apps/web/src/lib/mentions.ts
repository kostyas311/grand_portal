import type { User } from './store/auth.store';

export const TEXT_MENTION_REGEX =
  /@'((?:\\'|[^'])+)'\(([^)]+)\)|@\[(.+?)\]\(([^)]+)\)/g;

function decodeMentionName(value: string) {
  return value.replace(/\\'/g, "'");
}

function encodeMentionName(value: string) {
  return value.replace(/'/g, "\\'");
}

function getMentionMatchParts(match: RegExpExecArray) {
  return {
    name: decodeMentionName((match[1] || match[3] || '').trim()),
    id: (match[2] || match[4] || '').trim(),
  };
}

export function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function stripMentionMarkup(text?: string | null) {
  if (!text) {
    return '';
  }

  return text.replace(TEXT_MENTION_REGEX, (...args) => {
    const match = args.slice(0, 5) as unknown as RegExpExecArray;
    return `@${getMentionMatchParts(match).name}`;
  });
}

export function textMentionsToHtml(text?: string | null) {
  const source = text || '';
  const escaped = escapeHtml(source).replace(/\n/g, '<br />');

  return escaped.replace(
    /@'((?:\\'|[^'])+)'\(([^)]+)\)|@\[(.+?)\]\(([^)]+)\)/g,
    (_, quotedName: string, quotedId: string, legacyName: string, legacyId: string) => {
      const name = decodeMentionName(quotedName || legacyName || '');
      const userId = quotedId || legacyId || '';
      return `<span class="mention-token" contenteditable="false" data-mention-id="${escapeHtml(userId)}" data-mention-name="${escapeHtml(name)}">@${escapeHtml(name)}</span>`;
    },
  );
}

export function textWithMentionsFromEditable(root: HTMLElement) {
  const chunks: string[] = [];

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      chunks.push(node.textContent || '');
      return;
    }

    if (!(node instanceof HTMLElement)) {
      return;
    }

    if (node.matches('.mention-token[data-mention-id][data-mention-name]')) {
      const mentionId = node.dataset.mentionId || '';
      const mentionName = node.dataset.mentionName || node.textContent?.replace(/^@/, '') || '';
      chunks.push(`@'${encodeMentionName(mentionName)}'(${mentionId})`);
      return;
    }

    if (node.tagName === 'BR') {
      chunks.push('\n');
      return;
    }

    if (node !== root && ['DIV', 'P'].includes(node.tagName) && chunks.length > 0) {
      const last = chunks[chunks.length - 1];
      if (last !== '\n') {
        chunks.push('\n');
      }
    }

    Array.from(node.childNodes).forEach(walk);

    if (node !== root && ['DIV', 'P'].includes(node.tagName)) {
      const last = chunks[chunks.length - 1];
      if (last !== '\n') {
        chunks.push('\n');
      }
    }
  };

  Array.from(root.childNodes).forEach(walk);
  return chunks.join('').replace(/\n{3,}/g, '\n\n').trimEnd();
}

export function extractMentionedUsersFromText(text?: string | null) {
  const mentions: Array<{ id: string; name: string }> = [];
  if (!text) {
    return mentions;
  }

  let match: RegExpExecArray | null;
  while ((match = TEXT_MENTION_REGEX.exec(text)) !== null) {
    const { name, id } = getMentionMatchParts(match);
    if (id && name) {
      mentions.push({ id, name });
    }
  }
  TEXT_MENTION_REGEX.lastIndex = 0;

  return mentions;
}

export function getMentionSuggestions(users: User[], query: string) {
  const normalized = query.trim().toLowerCase();
  const sorted = [...users].sort((left, right) =>
    left.fullName.localeCompare(right.fullName, 'ru'),
  );

  if (!normalized) {
    return sorted.slice(0, 8);
  }

  return sorted
    .filter((user) =>
      [user.fullName, user.email, user.position || '']
        .join(' ')
        .toLowerCase()
        .includes(normalized),
    )
    .slice(0, 8);
}

function isMentionTokenNode(node: Node | null) {
  return node instanceof HTMLElement && node.matches('.mention-token');
}

function createEligibleTextWalker(root: HTMLElement) {
  return document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parentElement = node.parentElement;
        if (!parentElement || parentElement.closest('.mention-token')) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );
}

function getClosestMentionBlock(node: Node | null, root: HTMLElement): HTMLElement | null {
  const element =
    node instanceof HTMLElement ? node : node?.parentElement instanceof HTMLElement ? node.parentElement : null;

  if (!element) {
    return null;
  }

  const block = element.closest(
    'p, div, li, blockquote, td, th, pre, h1, h2, h3, h4, h5, h6',
  );

  if (!block || !root.contains(block)) {
    return root;
  }

  return block as HTMLElement;
}

function findFirstTextNode(node: Node | null): Text | null {
  if (!node) {
    return null;
  }

  const walker = document.createTreeWalker(
    node,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(current) {
        const parentElement = current.parentElement;
        if (!parentElement || parentElement.closest('.mention-token')) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  return walker.nextNode() as Text | null;
}

function findLastTextNode(node: Node | null): Text | null {
  if (!node) {
    return null;
  }

  const walker = document.createTreeWalker(
    node,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(current) {
        const parentElement = current.parentElement;
        if (!parentElement || parentElement.closest('.mention-token')) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  let lastNode: Text | null = null;
  let currentNode: Node | null;

  while ((currentNode = walker.nextNode())) {
    lastNode = currentNode as Text;
  }

  return lastNode;
}

function resolveCaretTextPosition(
  root: HTMLElement,
  range: Range,
): { node: Text; offset: number } | null {
  if (range.startContainer.nodeType === Node.TEXT_NODE) {
    const textNode = range.startContainer as Text;
    if (root.contains(textNode) && !textNode.parentElement?.closest('.mention-token')) {
      return { node: textNode, offset: range.startOffset };
    }
  }

  if (!(range.startContainer instanceof HTMLElement) || !root.contains(range.startContainer)) {
    return null;
  }

  const container = range.startContainer;
  const beforeNode = container.childNodes[range.startOffset - 1] || null;
  const beforeText = findLastTextNode(beforeNode);
  if (beforeText) {
    return { node: beforeText, offset: beforeText.data.length };
  }

  const afterNode = container.childNodes[range.startOffset] || null;
  const afterText = findFirstTextNode(afterNode);
  if (afterText) {
    return { node: afterText, offset: 0 };
  }

  return null;
}

export type MentionMatch = {
  query: string;
  startNode: Text;
  startOffset: number;
  endNode: Text;
  endOffset: number;
  rect: DOMRect;
};

export function findMentionMatchInContentEditable(root: HTMLElement): MentionMatch | null {
  const selection = window.getSelection();
  const range =
    selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  if (!range || !range.collapsed || !root.contains(range.startContainer)) {
    return null;
  }

  if (
    range.startContainer instanceof HTMLElement &&
    (isMentionTokenNode(range.startContainer) || range.startContainer.closest('.mention-token'))
  ) {
    return null;
  }

  const caret = resolveCaretTextPosition(root, range);
  if (!caret) {
    return null;
  }

  const walker = createEligibleTextWalker(root);
  const textNodes: Text[] = [];
  let currentNode: Node | null;
  while ((currentNode = walker.nextNode())) {
    textNodes.push(currentNode as Text);
  }

  const currentIndex = textNodes.indexOf(caret.node);
  if (currentIndex === -1) {
    return null;
  }

  const caretBlock = getClosestMentionBlock(caret.node, root);
  const parts: string[] = [];
  for (let index = currentIndex; index >= 0; index -= 1) {
    if (index !== currentIndex) {
      const candidateBlock = getClosestMentionBlock(textNodes[index], root);
      if (candidateBlock !== caretBlock) {
        break;
      }
    }

    const chunk = index === currentIndex
      ? textNodes[index].data.slice(0, caret.offset)
      : textNodes[index].data;
    parts.unshift(chunk);

    if (/\s/.test(chunk) || parts.join('').length >= 120) {
      break;
    }
  }

  const beforeCaret = parts.join('');
  const match = beforeCaret.match(/(^|\s)@([^\s@]*)$/);
  if (!match) {
    return null;
  }

  const mentionText = match[0].slice(match[0].lastIndexOf('@'));
  let remaining = mentionText.length;
  let startNode = caret.node;
  let startOffset = caret.offset;

  for (let index = currentIndex; index >= 0; index -= 1) {
    const available = index === currentIndex ? caret.offset : textNodes[index].data.length;
    if (remaining <= available) {
      startNode = textNodes[index];
      startOffset = available - remaining;
      break;
    }

    remaining -= available;
  }

  return {
    query: match[2] || '',
    startNode,
    startOffset,
    endNode: caret.node,
    endOffset: caret.offset,
    rect: range.getBoundingClientRect(),
  };
}
