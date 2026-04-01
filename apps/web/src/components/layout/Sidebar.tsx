'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, FileText, CheckCircle, BookOpen, Users, LogOut, User, ChevronRight, BarChart2, MessageSquareQuote, Mail, ScrollText, CalendarRange, Boxes,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store/auth.store';
import { authApi } from '@/lib/api';
import { toast } from 'sonner';
import { BrandBlock } from '@/components/shared/BrandBlock';

const managerNavItems = [
  { href: '/dashboard', label: 'Мой кабинет', icon: LayoutDashboard },
  { href: '/cards', label: 'Все карточки', icon: FileText },
  { href: '/admin/sprints', label: 'Спринты', icon: CalendarRange },
  { href: '/instructions', label: 'Инструкции', icon: ScrollText },
  { href: '/components', label: 'Компоненты', icon: Boxes },
  { href: '/requests', label: 'Обращения', icon: MessageSquareQuote },
  { href: '/', label: 'Готовые проекты', icon: CheckCircle },
  { href: '/sources', label: 'Источники НСД', icon: BookOpen },
  { href: '/reports', label: 'Отчёты', icon: BarChart2 },
];

const userNavItems = [
  { href: '/dashboard', label: 'Мой кабинет', icon: LayoutDashboard },
  { href: '/instructions', label: 'Инструкции', icon: ScrollText },
  { href: '/components', label: 'Компоненты', icon: Boxes },
  { href: '/requests', label: 'Обращения', icon: MessageSquareQuote },
];

const adminNavItems = [
  { href: '/cards', label: 'Все карточки', icon: FileText },
  { href: '/instructions', label: 'Инструкции', icon: ScrollText },
  { href: '/components', label: 'Компоненты', icon: Boxes },
  { href: '/requests', label: 'Обращения', icon: MessageSquareQuote },
  { href: '/', label: 'Готовые проекты', icon: CheckCircle },
  { href: '/sources', label: 'Источники НСД', icon: BookOpen },
  { href: '/reports', label: 'Отчёты', icon: BarChart2 },
];

const adminItems = [
  { href: '/admin/users', label: 'Пользователи', icon: Users },
  { href: '/admin/sprints', label: 'Спринты', icon: CalendarRange },
  { href: '/admin/notifications', label: 'Email-уведомления', icon: Mail },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Администратор',
  MANAGER: 'Руководитель',
  USER: 'Пользователь',
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const isAdmin = user?.role === 'ADMIN';
  const isUser = user?.role === 'USER';
  const navItems = isAdmin ? adminNavItems : isUser ? userNavItems : managerNavItems;

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {}
    logout();
    router.push('/login');
    toast.success('Выход выполнен');
  };

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/10">
        <BrandBlock variant="sidebar" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto scrollbar-hide">
        <div className="mb-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn('sidebar-nav-item', isActive && 'active')}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Admin section */}
        {isAdmin && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="px-4 mb-2">
              <span className="text-blue-300 text-xs font-semibold uppercase tracking-wider">
                Администрирование
              </span>
            </div>
            {adminItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn('sidebar-nav-item', isActive && 'active')}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* User section */}
      <div className="border-t border-white/10 p-3">
        <Link
          href="/profile"
          className="flex items-center gap-3 px-3 py-2.5 rounded-sm hover:bg-white/10 transition-colors cursor-pointer no-underline"
        >
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-medium truncate">{user?.fullName}</div>
            <div className="text-blue-200 text-xs truncate">
              {user?.role ? (ROLE_LABELS[user.role] || user.role) : ''}
            </div>
          </div>
          <ChevronRight className="w-3 h-3 text-blue-300 flex-shrink-0" />
        </Link>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-sm hover:bg-white/10 transition-colors text-blue-100 text-sm mt-1"
        >
          <LogOut className="w-4 h-4" />
          <span>Выйти</span>
        </button>
      </div>
    </aside>
  );
}
