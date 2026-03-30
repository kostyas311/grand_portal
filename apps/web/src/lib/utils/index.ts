import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, isPast, isToday } from 'date-fns';
import { ru } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return format(new Date(date), 'dd.MM.yyyy', { locale: ru });
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return format(new Date(date), 'dd.MM.yyyy HH:mm', { locale: ru });
}

export function formatRelative(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ru });
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return '—';
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function getMonthName(month: number): string {
  const months = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
  ];
  return months[month - 1] || `Месяц ${month}`;
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    NEW: 'Новое',
    IN_PROGRESS: 'В работе',
    REVIEW: 'На проверке',
    DONE: 'Готово',
    CANCELLED: 'Отменено',
  };
  return labels[status] || status;
}

export function getStatusClass(status: string): string {
  const classes: Record<string, string> = {
    NEW: 'badge-new',
    IN_PROGRESS: 'badge-in-progress',
    REVIEW: 'badge-review',
    DONE: 'badge-done',
    CANCELLED: 'badge-cancelled',
  };
  return classes[status] || 'badge';
}

export function getPriorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    OPTIONAL: 'Желательно',
    NORMAL: 'В рабочем режиме',
    URGENT: 'Срочно',
    CRITICAL: 'Очень срочно',
  };
  return labels[priority] || priority;
}

export function getPriorityClass(priority: string): string {
  const classes: Record<string, string> = {
    OPTIONAL: 'priority-optional',
    NORMAL: 'priority-normal',
    URGENT: 'priority-urgent',
    CRITICAL: 'priority-critical',
  };
  return classes[priority] || '';
}

export function isDueDateOverdue(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  return isPast(new Date(dueDate)) && !isToday(new Date(dueDate));
}

export function isDueDateToday(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  return isToday(new Date(dueDate));
}

export function getHistoryActionLabel(action: string): string {
  const labels: Record<string, string> = {
    CREATED: 'Карточка создана',
    STATUS_CHANGED: 'Статус изменён',
    EXECUTOR_CHANGED: 'Исполнитель изменён',
    REVIEWER_CHANGED: 'Проверяющий изменён',
    SOURCE_MATERIAL_ADDED: 'Материал добавлен',
    SOURCE_MATERIAL_REMOVED: 'Материал удалён',
    RESULT_ADDED: 'Результат загружен',
    RETURNED_WITH_ERRORS: 'Возвращено с замечаниями',
    COMPLETED: 'Карточка завершена',
    CANCELLED: 'Карточка отменена',
    FIELD_UPDATED: 'Данные обновлены',
  };
  return labels[action] || action;
}

// Возвращает null для завершённых/отменённых карточек без срока
// 'red' — просрочено, 'orange' — осталось ≤3 дня, 'green' — всё ок
export function getDueDateIndicator(
  dueDate: string | null | undefined,
  status: string,
): 'red' | 'orange' | 'green' | null {
  if (!dueDate || status === 'DONE' || status === 'CANCELLED') return null;
  const now = new Date();
  const due = new Date(dueDate);
  const diffDays = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return 'red';
  if (diffDays <= 3) return 'orange';
  return 'green';
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function getCardPublicUrl(publicId: string): string {
  return `${window.location.origin}/cards/${publicId}`;
}

// Detect Windows local paths: C:\..., \\server\share, //server/share
export function isLocalPath(url: string): boolean {
  if (!url) return false;
  return /^[a-zA-Z]:[\\\/]/.test(url) || url.startsWith('\\\\') || url.startsWith('//');
}

// Convert a local path to a file:// URL for browser open attempt
export function toFileUrl(path: string): string {
  if (/^[a-zA-Z]:[\\\/]/.test(path)) {
    return 'file:///' + path.replace(/\\/g, '/');
  }
  if (path.startsWith('\\\\')) {
    return 'file://' + path.slice(2).replace(/\\/g, '/');
  }
  if (path.startsWith('//')) {
    return 'file:' + path;
  }
  return path;
}
