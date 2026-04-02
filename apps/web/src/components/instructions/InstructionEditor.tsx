'use client';

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bold,
  Boxes,
  Code2,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Paperclip,
  Plus,
  Quote,
  Search,
  Underline,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ComponentItem } from '@/lib/api/components';

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
  components?: ComponentItem[];
}

function ToolbarButton({
  onClick,
  title,
  children,
  active = false,
  disabled = false,
}: {
  onClick: () => void;
  title: string;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      title={title}
      className={cn(
        'flex h-9 min-w-9 items-center justify-center rounded-xl border px-2 text-slate-600 transition',
        active ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white',
        disabled ? 'cursor-not-allowed opacity-45' : 'hover:bg-slate-100',
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
  components = [],
}: InstructionEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [showLinkPanel, setShowLinkPanel] = useState(false);
  const [showAttachmentPanel, setShowAttachmentPanel] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [selectedLinkText, setSelectedLinkText] = useState('');
  const [componentSearch, setComponentSearch] = useState('');
  const [isTableSelection, setIsTableSelection] = useState(false);

  const attachmentOptions = useMemo(
    () => [...attachments].sort((a, b) => a.fileName.localeCompare(b.fileName, 'ru')),
    [attachments],
  );

  const filteredComponents = useMemo(() => {
    const query = componentSearch.trim().toLowerCase();

    return components.filter((component) => {
      if (!query) {
        return true;
      }

      return [component.name, component.publicId, component.description || '', component.location]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [componentSearch, components]);

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

  const findClosestTableCell = (node: Node | null): HTMLTableCellElement | null => {
    if (!node) {
      return null;
    }

    const element =
      node instanceof HTMLElement ? node : node.parentElement instanceof HTMLElement ? node.parentElement : null;

    return element?.closest('td, th') as HTMLTableCellElement | null;
  };

  const updateSelectionState = () => {
    saveSelection();

    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() || '';
    const anchorNode =
      selection?.rangeCount && selection.getRangeAt(0)
        ? selection.getRangeAt(0).commonAncestorContainer
        : null;

    setSelectedLinkText(selectedText);
    setIsTableSelection(Boolean(findClosestTableCell(anchorNode)));
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

  const restoreSelectionFromPoint = (clientX: number, clientY: number) => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection) {
      return;
    }

    editor.focus();

    const documentAny = document as Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
      caretPositionFromPoint?: (
        x: number,
        y: number,
      ) => { offsetNode: Node; offset: number } | null;
    };

    let range: Range | null = null;

    if (documentAny.caretRangeFromPoint) {
      range = documentAny.caretRangeFromPoint(clientX, clientY);
    } else if (documentAny.caretPositionFromPoint) {
      const position = documentAny.caretPositionFromPoint(clientX, clientY);
      if (position) {
        range = document.createRange();
        range.setStart(position.offsetNode, position.offset);
        range.collapse(true);
      }
    }

    if (!range || !editor.contains(range.commonAncestorContainer)) {
      return;
    }

    selection.removeAllRanges();
    selection.addRange(range);
    savedRangeRef.current = range.cloneRange();
  };

  const getActiveTableCell = () => {
    const selection = window.getSelection();
    const range =
      selection?.rangeCount && selection.getRangeAt(0)
        ? selection.getRangeAt(0)
        : savedRangeRef.current;

    if (!range) {
      return null;
    }

    const cell = findClosestTableCell(range.commonAncestorContainer);
    if (!cell || !editorRef.current?.contains(cell)) {
      return null;
    }

    return cell;
  };

  const focusCell = (cell: HTMLTableCellElement | null) => {
    const selection = window.getSelection();
    if (!cell || !selection) {
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(cell);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    savedRangeRef.current = range.cloneRange();
    editorRef.current?.focus();
    updateSelectionState();
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

    if (range) {
      const selectedText = range.toString().trim() || selectedLinkText;
      const anchorText = selectedText || trimmedUrl;
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
    setSelectedLinkText('');
    setShowLinkPanel(false);
  };

  const insertDefaultTable = () => {
    insertHtml(
      '<table><thead><tr><th>Колонка 1</th><th>Колонка 2</th><th>Колонка 3</th></tr></thead><tbody><tr><td>Значение</td><td>Значение</td><td>Значение</td></tr><tr><td>Значение</td><td>Значение</td><td>Значение</td></tr></tbody></table><p></p>',
    );
  };

  const addTableRow = () => {
    restoreSelection();
    const cell = getActiveTableCell();
    const row = cell?.closest('tr') as HTMLTableRowElement | null;
    const table = cell?.closest('table') as HTMLTableElement | null;

    if (!cell || !row || !table) {
      toast.error('Поставь курсор внутрь таблицы');
      return;
    }

    const tbody =
      row.parentElement?.tagName === 'TBODY'
        ? (row.parentElement as HTMLTableSectionElement)
        : table.tBodies[0] || table.createTBody();

    const newRow = tbody.insertRow(row.parentElement?.tagName === 'TBODY' ? row.sectionRowIndex + 1 : tbody.rows.length);
    Array.from({ length: row.cells.length || 1 }).forEach(() => {
      const newCell = document.createElement('td');
      newCell.textContent = 'Значение';
      newRow.appendChild(newCell);
    });

    syncContent();
    focusCell(newRow.cells[Math.min(cell.cellIndex, newRow.cells.length - 1)] as HTMLTableCellElement);
  };

  const addTableColumn = () => {
    restoreSelection();
    const cell = getActiveTableCell();
    const table = cell?.closest('table') as HTMLTableElement | null;

    if (!cell || !table) {
      toast.error('Поставь курсор внутрь таблицы');
      return;
    }

    const insertIndex = cell.cellIndex + 1;
    Array.from(table.rows).forEach((row, rowIndex) => {
      const tagName = row.parentElement?.tagName === 'THEAD' || rowIndex === 0 ? 'th' : 'td';
      const newCell = document.createElement(tagName);
      newCell.textContent = tagName === 'th' ? `Колонка ${insertIndex + 1}` : 'Значение';
      row.insertBefore(newCell, row.cells[insertIndex] || null);
    });

    syncContent();
    const targetRow = table.rows[Math.max((cell.parentElement as HTMLTableRowElement).rowIndex, 0)];
    focusCell((targetRow?.cells[insertIndex] as HTMLTableCellElement) || null);
  };

  const removeTableRow = () => {
    restoreSelection();
    const cell = getActiveTableCell();
    const row = cell?.closest('tr') as HTMLTableRowElement | null;
    const tbody = row?.parentElement?.tagName === 'TBODY' ? (row.parentElement as HTMLTableSectionElement) : null;

    if (!cell || !row || !tbody) {
      toast.error('Удалять строки можно только в теле таблицы');
      return;
    }

    if (tbody.rows.length <= 1) {
      toast.error('В таблице должна остаться хотя бы одна строка');
      return;
    }

    const nextRow =
      (row.nextElementSibling as HTMLTableRowElement | null) ||
      (row.previousElementSibling as HTMLTableRowElement | null) ||
      null;

    row.remove();
    syncContent();
    focusCell((nextRow?.cells[Math.min(cell.cellIndex, (nextRow?.cells.length || 1) - 1)] as HTMLTableCellElement) || null);
  };

  const removeTableColumn = () => {
    restoreSelection();
    const cell = getActiveTableCell();
    const table = cell?.closest('table') as HTMLTableElement | null;

    if (!cell || !table) {
      toast.error('Поставь курсор внутрь таблицы');
      return;
    }

    const columnIndex = cell.cellIndex;
    const headerColumns = table.rows[0]?.cells.length || 0;

    if (headerColumns <= 1) {
      toast.error('В таблице должен остаться хотя бы один столбец');
      return;
    }

    Array.from(table.rows).forEach((row) => {
      if (row.cells[columnIndex]) {
        row.deleteCell(columnIndex);
      }
    });

    syncContent();
    const rowIndex = Math.max((cell.parentElement as HTMLTableRowElement).rowIndex, 0);
    const targetRow = table.rows[rowIndex] || table.rows[Math.min(rowIndex, table.rows.length - 1)];
    const targetIndex = Math.max(columnIndex - 1, 0);
    focusCell((targetRow?.cells[targetIndex] as HTMLTableCellElement) || null);
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

  const insertComponentDirective = () => {
    saveSelection();
    const componentRef = window.prompt('Укажи код или ID компонента, например CMP-2026-0001');
    const trimmedRef = componentRef?.trim();

    if (!trimmedRef) {
      return;
    }

    insertHtml(`{{ ${escapeHtml(trimmedRef)} }}`);
    toast.success('Директива компонента вставлена');
  };

  const insertComponentDirectiveByRef = (componentRef: string) => {
    insertHtml(`{{ ${escapeHtml(componentRef)} }}`);
    toast.success('Компонент вставлен в инструкцию');
  };

  const handleComponentDrop = (event: React.DragEvent<HTMLDivElement>) => {
    const componentRef =
      event.dataTransfer.getData('application/x-normbase-component-ref') ||
      event.dataTransfer.getData('text/plain');

    if (!componentRef) {
      return;
    }

    event.preventDefault();
    restoreSelectionFromPoint(event.clientX, event.clientY);
    insertComponentDirectiveByRef(componentRef.trim());
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

  useEffect(() => {
    const handleSelectionChange = () => updateSelectionState();
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  return (
    <div className="instruction-editor-shell">
      <div className="instruction-editor-layout">
        <div className="instruction-editor-main">
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
                  <span className="relative h-4 w-4">
                    <span className="absolute inset-x-0 top-0 h-[2px] rounded bg-current opacity-85" />
                    <span className="absolute inset-x-0 top-[5px] h-[7px] rounded border border-current opacity-85" />
                    <span className="absolute left-[3px] right-[3px] bottom-[2px] h-[1.5px] rounded bg-current opacity-75" />
                  </span>
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
                  onClick={insertDefaultTable}
                  title="Таблица"
                >
                  <span className="grid h-4 w-4 grid-cols-2 grid-rows-2 gap-[2px]">
                    <span className="rounded-[2px] border border-current opacity-85" />
                    <span className="rounded-[2px] border border-current opacity-85" />
                    <span className="rounded-[2px] border border-current opacity-85" />
                    <span className="rounded-[2px] border border-current opacity-85" />
                  </span>
                </ToolbarButton>
                <ToolbarButton
                  onClick={addTableRow}
                  title="Добавить строку"
                  disabled={!isTableSelection}
                >
                  <span className="relative h-4 w-4">
                    <span className="absolute inset-x-0 top-[1px] h-[2px] rounded bg-current opacity-85" />
                    <span className="absolute inset-x-0 top-[6px] h-[2px] rounded bg-current opacity-55" />
                    <span className="absolute inset-x-0 top-[11px] h-[2px] rounded bg-current opacity-55" />
                    <Plus className="absolute -right-[6px] -top-[5px] h-3 w-3 rounded-full bg-[var(--color-surface)]" />
                  </span>
                </ToolbarButton>
                <ToolbarButton
                  onClick={addTableColumn}
                  title="Добавить столбец"
                  disabled={!isTableSelection}
                >
                  <span className="relative h-4 w-4">
                    <span className="absolute inset-y-0 left-[1px] w-[2px] rounded bg-current opacity-85" />
                    <span className="absolute inset-y-0 left-[6px] w-[2px] rounded bg-current opacity-55" />
                    <span className="absolute inset-y-0 left-[11px] w-[2px] rounded bg-current opacity-55" />
                    <Plus className="absolute -right-[6px] -top-[5px] h-3 w-3 rounded-full bg-[var(--color-surface)]" />
                  </span>
                </ToolbarButton>
                <ToolbarButton
                  onClick={removeTableRow}
                  title="Удалить строку"
                  disabled={!isTableSelection}
                >
                  <span className="relative h-4 w-4">
                    <span className="absolute inset-x-0 top-[1px] h-[2px] rounded bg-current opacity-85" />
                    <span className="absolute inset-x-0 top-[6px] h-[2px] rounded bg-current opacity-55" />
                    <span className="absolute inset-x-0 top-[11px] h-[2px] rounded bg-current opacity-55" />
                    <X className="absolute -right-[6px] -top-[5px] h-3 w-3 rounded-full bg-[var(--color-surface)] p-[1px]" />
                  </span>
                </ToolbarButton>
                <ToolbarButton
                  onClick={removeTableColumn}
                  title="Удалить столбец"
                  disabled={!isTableSelection}
                >
                  <span className="relative h-4 w-4">
                    <span className="absolute inset-y-0 left-[1px] w-[2px] rounded bg-current opacity-85" />
                    <span className="absolute inset-y-0 left-[6px] w-[2px] rounded bg-current opacity-55" />
                    <span className="absolute inset-y-0 left-[11px] w-[2px] rounded bg-current opacity-55" />
                    <X className="absolute -right-[6px] -top-[5px] h-3 w-3 rounded-full bg-[var(--color-surface)] p-[1px]" />
                  </span>
                </ToolbarButton>
            </div>

            <div className="instruction-toolbar-group">
              <ToolbarButton
                onClick={() => {
                  updateSelectionState();
                  setShowAttachmentPanel(false);
                  setLinkUrl('');
                  setShowLinkPanel((current) => !current);
                }}
                title="Вставить ссылку"
                active={showLinkPanel}
              >
                <Link2 className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={insertComponentDirective}
                title="Вставить компонент по директиве"
              >
                <Boxes className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => {
                  saveSelection();
                  setShowLinkPanel(false);
                  setShowAttachmentPanel((current) => !current);
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
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <input
                  className="input"
                  placeholder="https://..."
                  value={linkUrl}
                  onChange={(event) => setLinkUrl(event.target.value)}
                />
                <button type="button" className="btn-primary" onClick={insertLink}>
                  Вставить
                </button>
              </div>
              <div className="text-xs text-slate-500">
                {selectedLinkText
                  ? `Ссылка будет вставлена на выделенный текст: "${selectedLinkText}".`
                  : 'Если текст не выделен, в редактор вставится сама ссылка.'}
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
                          {attachment.pending
                            ? 'Будет загружено после сохранения инструкции'
                            : 'Доступно для вставки в текст'}
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
            onMouseUp={updateSelectionState}
            onKeyUp={updateSelectionState}
            onBlur={updateSelectionState}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleComponentDrop}
          />
        </div>

        <aside className="instruction-components-sidebar">
          <div className="instruction-components-sidebar-header">
            <div>
              <div className="section-surface-title">Компоненты</div>
              <div className="section-surface-subtitle">
                Перетащи компонент в текст или вставь его кнопкой.
              </div>
            </div>
          </div>

          <div className="instruction-components-sidebar-body">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-9"
                placeholder="Поиск компонента..."
                value={componentSearch}
                onChange={(event) => setComponentSearch(event.target.value)}
              />
            </div>

            <div className="instruction-components-list">
              {filteredComponents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  Компоненты не найдены.
                </div>
              ) : (
                filteredComponents.map((component) => (
                  <div
                    key={component.id}
                    className="instruction-component-card"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData(
                        'application/x-normbase-component-ref',
                        component.publicId,
                      );
                      event.dataTransfer.setData('text/plain', component.publicId);
                      event.dataTransfer.effectAllowed = 'copy';
                    }}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-800">
                        {component.name}
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-slate-400">
                        {component.publicId}
                      </div>
                      <div className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
                        {component.description || component.location}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary mt-3 w-full justify-center px-3 py-2 text-xs"
                      onClick={() => insertComponentDirectiveByRef(component.publicId)}
                    >
                      Вставить
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
