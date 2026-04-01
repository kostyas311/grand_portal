'use client';

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bold,
  Code2,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Paperclip,
  Quote,
  Underline,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface InstructionEditorAttachmentOption {
  key: string;
  fileName: string;
  href?: string;
  pending?: boolean;
}

interface InstructionEditorProps {
  value: string;
  onChange: (html: string) => void;
  attachments?: InstructionEditorAttachmentOption[];
  onAddPendingAttachments?: (files: File[]) => InstructionEditorAttachmentOption[];
}

function ToolbarButton({
  onClick,
  title,
  children,
  active = false,
}: {
  onClick: () => void;
  title: string;
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      title={title}
      className={cn(
        'flex h-9 min-w-9 items-center justify-center rounded-xl border px-2 text-slate-600 transition hover:bg-slate-100',
        active ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white',
      )}
    >
      {children}
    </button>
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function InstructionEditor({
  value,
  onChange,
  attachments = [],
  onAddPendingAttachments,
}: InstructionEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [showLinkPanel, setShowLinkPanel] = useState(false);
  const [showAttachmentPanel, setShowAttachmentPanel] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');

  const attachmentOptions = useMemo(
    () => [...attachments].sort((a, b) => a.fileName.localeCompare(b.fileName, 'ru')),
    [attachments],
  );

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.innerHTML !== value) {
      editor.innerHTML = value || '';
    }
  }, [value]);

  const syncContent = () => {
    const editor = editorRef.current;
    if (!editor) return;
    onChange(editor.innerHTML);
  };

  const saveSelection = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
    }
  };

  const restoreSelection = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection) return;

    editor.focus();
    if (savedRangeRef.current) {
      selection.removeAllRanges();
      selection.addRange(savedRangeRef.current);
    }
  };

  const exec = (command: string, commandValue?: string) => {
    restoreSelection();
    document.execCommand(command, false, commandValue);
    syncContent();
    saveSelection();
  };

  const insertHtml = (html: string) => {
    restoreSelection();
    document.execCommand('insertHTML', false, html);
    syncContent();
    saveSelection();
  };

  const formatBlock = (tagName: 'p' | 'h2' | 'h3' | 'blockquote') => {
    exec('formatBlock', `<${tagName}>`);
  };

  const insertLink = () => {
    const trimmedUrl = linkUrl.trim();
    if (!trimmedUrl) {
      toast.error('Укажи URL для ссылки');
      return;
    }
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      toast.error('Ссылка должна начинаться с http:// или https://');
      return;
    }

    restoreSelection();
    const selection = window.getSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    const label = linkLabel.trim();

    if (range) {
      const selectedText = range.toString().trim();
      const anchorText = label || selectedText || trimmedUrl;
      range.deleteContents();
      const anchor = document.createElement('a');
      anchor.href = trimmedUrl;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.textContent = anchorText;
      range.insertNode(anchor);
      range.setStartAfter(anchor);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
      syncContent();
      saveSelection();
    }

    setLinkUrl('');
    setLinkLabel('');
    setShowLinkPanel(false);
  };

  const insertAttachmentAnchor = (attachment: InstructionEditorAttachmentOption) => {
    const attrs = attachment.pending
      ? `data-pending-attachment-key="${escapeHtml(attachment.key)}"`
      : `href="${escapeHtml(attachment.href || '#')}" target="_blank" rel="noopener noreferrer"`;

    insertHtml(
      `<a ${attrs} class="instruction-inline-attachment">${escapeHtml(attachment.fileName)}</a>&nbsp;`,
    );
    setShowAttachmentPanel(false);
  };

  const handleAddFiles = (fileList: FileList | null) => {
    if (!fileList?.length || !onAddPendingAttachments) {
      return;
    }

    const added = onAddPendingAttachments(Array.from(fileList));
    if (!added.length) {
      toast.warning('Эти файлы уже добавлены к инструкции');
      return;
    }

    added.forEach((attachment) => insertAttachmentAnchor(attachment));
    toast.success('Вложение добавлено в инструкцию');
  };

  return (
    <div className="instruction-editor-shell">
      <div className="instruction-editor-toolbar">
        <div className="instruction-toolbar-group">
          <ToolbarButton onClick={() => formatBlock('p')} title="Обычный абзац">
            <span className="text-xs font-semibold">T</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => formatBlock('h2')} title="Подзаголовок">
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => formatBlock('h3')} title="Подраздел">
            <span className="text-xs font-semibold">H3</span>
          </ToolbarButton>
        </div>

        <div className="instruction-toolbar-group">
          <ToolbarButton onClick={() => exec('bold')} title="Жирный">
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => exec('italic')} title="Курсив">
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => exec('underline')} title="Подчёркнутый">
            <Underline className="h-4 w-4" />
          </ToolbarButton>
        </div>

        <div className="instruction-toolbar-group">
          <ToolbarButton onClick={() => exec('insertUnorderedList')} title="Маркированный список">
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => exec('insertOrderedList')} title="Нумерованный список">
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => formatBlock('blockquote')} title="Цитата">
            <Quote className="h-4 w-4" />
          </ToolbarButton>
        </div>

        <div className="instruction-toolbar-group">
          <ToolbarButton
            onClick={() =>
              insertHtml(
                '<div class="instruction-note"><strong>Важно.</strong> Опиши ключевое условие или замечание.</div><p></p>',
              )
            }
            title="Информационный блок"
          >
            <span className="text-xs font-semibold">Блок</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              insertHtml(
                '<pre><code>// Пример кода или команды\n</code></pre><p></p>',
              )
            }
            title="Блок кода"
          >
            <Code2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              insertHtml(
                '<table><thead><tr><th>Колонка 1</th><th>Колонка 2</th><th>Колонка 3</th></tr></thead><tbody><tr><td>Значение</td><td>Значение</td><td>Значение</td></tr><tr><td>Значение</td><td>Значение</td><td>Значение</td></tr></tbody></table><p></p>',
              )
            }
            title="Таблица"
          >
            <span className="text-xs font-semibold">Tbl</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              insertHtml(
                '<p><sup class="instruction-footnote-ref">[1]</sup> Ссылка на примечание.</p><div class="instruction-footnotes"><p><strong>[1]</strong> Текст сноски или дополнительного пояснения.</p></div>',
              )
            }
            title="Сноска"
          >
            <span className="text-xs font-semibold">Fn</span>
          </ToolbarButton>
        </div>

        <div className="instruction-toolbar-group">
          <ToolbarButton
            onClick={() => {
              saveSelection();
              setShowAttachmentPanel(false);
              setShowLinkPanel((value) => !value);
            }}
            title="Вставить ссылку"
            active={showLinkPanel}
          >
            <Link2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => {
              saveSelection();
              setShowLinkPanel(false);
              setShowAttachmentPanel((value) => !value);
            }}
            title="Вставить вложение"
            active={showAttachmentPanel}
          >
            <Paperclip className="h-4 w-4" />
          </ToolbarButton>
        </div>
      </div>

      {showLinkPanel && (
        <div className="instruction-inline-panel">
          <div className="instruction-inline-panel-header">
            <div className="text-sm font-semibold text-slate-800">Ссылка</div>
            <button
              type="button"
              className="btn-icon h-8 w-8 border border-slate-200 bg-white text-slate-500"
              onClick={() => setShowLinkPanel(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-[1.6fr_1fr_auto]">
            <input
              className="input"
              placeholder="https://..."
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
            />
            <input
              className="input"
              placeholder="Текст ссылки"
              value={linkLabel}
              onChange={(event) => setLinkLabel(event.target.value)}
            />
            <button type="button" className="btn-primary" onClick={insertLink}>
              Вставить
            </button>
          </div>
          <div className="text-xs text-slate-500">
            Если поле текста оставить пустым, редактор возьмёт выделенный фрагмент или сам URL.
          </div>
        </div>
      )}

      {showAttachmentPanel && (
        <div className="instruction-inline-panel">
          <div className="instruction-inline-panel-header">
            <div>
              <div className="text-sm font-semibold text-slate-800">Вложение в текст</div>
              <div className="mt-1 text-xs text-slate-500">
                Можно вставить уже приложенный файл или добавить новый.
              </div>
            </div>
            <button
              type="button"
              className="btn-icon h-8 w-8 border border-slate-200 bg-white text-slate-500"
              onClick={() => setShowAttachmentPanel(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-4 w-4" />
              Добавить файл
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              handleAddFiles(event.target.files);
              event.target.value = '';
            }}
          />

          {!attachmentOptions.length ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              Пока нет приложенных файлов. Добавь новый файл кнопкой выше.
            </div>
          ) : (
            <div className="space-y-2">
              {attachmentOptions.map((attachment) => (
                <div
                  key={attachment.key}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-800">{attachment.fileName}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {attachment.pending ? 'Будет загружено после сохранения инструкции' : 'Доступно для вставки в текст'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => insertAttachmentAnchor(attachment)}
                  >
                    Вставить
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div
        ref={editorRef}
        className="instruction-editor-canvas"
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Опиши порядок действий, добавь блоки, таблицы, код, ссылки и вложения..."
        onInput={syncContent}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        onBlur={saveSelection}
      />
    </div>
  );
}
