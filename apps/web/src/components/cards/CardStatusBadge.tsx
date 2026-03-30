import { cn } from '@/lib/utils';

interface CardStatusBadgeProps {
  status: string;
  className?: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string; dot: string }> = {
  NEW: { label: 'Новое', className: 'badge-new', dot: 'bg-blue-400' },
  IN_PROGRESS: { label: 'В работе', className: 'badge-in-progress', dot: 'bg-yellow-400' },
  REVIEW: { label: 'На проверке', className: 'badge-review', dot: 'bg-purple-400' },
  DONE: { label: 'Готово', className: 'badge-done', dot: 'bg-green-400' },
  CANCELLED: { label: 'Отменено', className: 'badge-cancelled', dot: 'bg-gray-400' },
};

export function CardStatusBadge({ status, className }: CardStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || { label: status, className: '', dot: 'bg-gray-400' };

  return (
    <span className={cn('badge', config.className, className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', config.dot)} />
      {config.label}
    </span>
  );
}
