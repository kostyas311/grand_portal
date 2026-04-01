declare module 'draftjs-to-html' {
  export default function draftToHtml(rawContentState: unknown): string;
}

declare module 'html-to-draftjs' {
  interface HtmlToDraftResult {
    contentBlocks: unknown[];
    entityMap: Record<string, unknown>;
  }

  export default function htmlToDraft(html: string): HtmlToDraftResult;
}
