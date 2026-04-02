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
