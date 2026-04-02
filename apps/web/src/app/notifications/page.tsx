'use client';

import { AppLayout } from '@/components/layout/AppLayout';
import { NotificationsCenterContent } from '@/components/notifications/NotificationsCenterContent';

export default function NotificationsPage() {
  return (
    <AppLayout>
      <div className="page-container-wide">
        <div className="page-hero">
          <div className="page-hero-body">
            <div className="page-title-row">
              <div className="flex-1 min-w-0">
                <div className="page-kicker">Коммуникации</div>
                <h1 className="mt-4 text-2xl font-semibold text-slate-900 dark:text-slate-100">Уведомления</h1>
                <p className="page-subtitle">
                  Все изменения по карточкам и обращениям, которые требуют вашего внимания, собраны в одном месте.
                </p>
              </div>
            </div>
          </div>
        </div>

        <NotificationsCenterContent />
      </div>
    </AppLayout>
  );
}
