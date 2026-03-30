import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';

interface CardPriorityBadgeProps {
  priority: string;
  className?: string;
}

const PRIORITY_CONFIG: Record<string, { label: string; className: string; pulse?: boolean }> = {
  OPTIONAL: { label: 'Желательно', className: 'priority-optional' },
  NORMAL: { label: 'В рабочем режиме', className: 'priority-normal' },
  URGENT: { label: 'Срочно', className: 'priority-urgent' },
  CRITICAL: { label: 'Очень срочно', className: 'priority-critical', pulse: true },
};

export function CardPriorityBadge({ priority, className }: CardPriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority] || { label: priority, className: '' };

  return (
    <span className={cn('badge', config.className, className)}>
      {config.pulse && (
        <AlertCircle className="w-3 h-3 flex-shrink-0 animate-pulse" />
      )}
      {config.label}
    </span>
  );
}
