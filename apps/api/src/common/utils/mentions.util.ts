const TEXT_MENTION_REGEX = /@'((?:\\'|[^'])+)'\(([^)]+)\)|@\[(.+?)\]\(([^)]+)\)/g;

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

export function extractMentionedUserIdsFromText(text?: string | null) {
  if (!text?.trim()) {
    return [];
  }

  const ids = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = TEXT_MENTION_REGEX.exec(text)) !== null) {
    const { id: userId } = getMentionMatchParts(match);
    if (userId) {
      ids.add(userId);
    }
  }

  TEXT_MENTION_REGEX.lastIndex = 0;
  return Array.from(ids);
}

export function extractMentionedUserIdsFromHtml(html?: string | null) {
  if (!html?.trim()) {
    return [];
  }

  const ids = new Set<string>();
  const attrPatterns = [
    /data-mention-id="([^"]+)"/g,
    /data-mention-id='([^']+)'/g,
  ];

  for (const pattern of attrPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      const userId = match[1]?.trim();
      if (userId) {
        ids.add(userId);
      }
    }
  }

  for (const userId of extractMentionedUserIdsFromText(html)) {
    ids.add(userId);
  }

  return Array.from(ids);
}

export function stripMentionMarkupFromText(text?: string | null) {
  if (!text) {
    return '';
  }

  return text.replace(TEXT_MENTION_REGEX, (...args) => {
    const match = args.slice(0, 5) as unknown as RegExpExecArray;
    return `@${getMentionMatchParts(match).name}`;
  });
}

export function stripMentionMarkupFromHtml(html?: string | null) {
  if (!html) {
    return '';
  }

  return html
    .replace(
      /<span[^>]*data-mention-id=(?:"[^"]+"|'[^']+')[^>]*data-mention-name=(?:"([^"]+)"|'([^']+)')[^>]*>(.*?)<\/span>/gi,
      (_, doubleQuotedName: string, singleQuotedName: string, innerText: string) =>
        `@${doubleQuotedName || singleQuotedName || innerText || ''}`,
    )
    .replace(TEXT_MENTION_REGEX, (...args) => {
      const match = args.slice(0, 5) as unknown as RegExpExecArray;
      return `@${getMentionMatchParts(match).name}`;
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function preserveMentionMarkupFromHtml(html?: string | null) {
  if (!html) {
    return '';
  }

  return html
    .replace(
      /<span[^>]*data-mention-id=(?:"([^"]+)"|'([^']+)')[^>]*data-mention-name=(?:"([^"]+)"|'([^']+)')[^>]*>(.*?)<\/span>/gi,
      (
        _,
        doubleQuotedId: string,
        singleQuotedId: string,
        doubleQuotedName: string,
        singleQuotedName: string,
        innerText: string,
      ) => {
        const userId = (doubleQuotedId || singleQuotedId || '').trim();
        const mentionName = (doubleQuotedName || singleQuotedName || innerText || '')
          .replace(/^@/, '')
          .trim();

        if (!userId || !mentionName) {
          return innerText || '';
        }

        return `@'${encodeMentionName(mentionName)}'(${userId})`;
      },
    )
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function compactMentionPreview(text?: string | null, maxLength = 180) {
  const source = text?.includes('<')
    ? preserveMentionMarkupFromHtml(text)
    : text || '';
  const normalized = source.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 3)}...`
    : normalized;
}

export function getNewMentionedUserIds(
  previous: Array<string | null | undefined>,
  next: Array<string | null | undefined>,
  exclude: Array<string | null | undefined> = [],
) {
  const previousIds = new Set(previous.filter(Boolean) as string[]);
  const excludedIds = new Set(exclude.filter(Boolean) as string[]);

  return Array.from(
    new Set(next.filter(Boolean) as string[]),
  ).filter((userId) => !previousIds.has(userId) && !excludedIds.has(userId));
}
