'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

export function HelpButton() {
  const pathname = usePathname();
  const isActive = pathname === '/help';

  return (
    <Link
      href="/help"
      className={cn(
        'inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium shadow-sm transition',
        isActive
          ? 'border-amber-300 bg-amber-50 text-amber-700'
          : 'border-slate-200 bg-white text-slate-600 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-amber-500/40 dark:hover:bg-amber-500/10 dark:hover:text-amber-200',
      )}
      title="Справка"
      aria-label="Справка"
    >
      <Lightbulb className="h-5 w-5" />
      <span className="hidden md:inline">Справка</span>
    </Link>
  );
}
