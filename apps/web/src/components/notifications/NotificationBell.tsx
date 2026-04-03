'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';
import { NotificationsCenterContent } from './NotificationsCenterContent';

function playNotificationSound() {
  if (typeof window === 'undefined') {
    return;
  }

  const AudioContextConstructor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextConstructor) {
    return;
  }

  const context = new AudioContextConstructor();
  const now = context.currentTime;

  const masterGain = context.createGain();
  masterGain.gain.setValueAtTime(0.0001, now);
  masterGain.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
  masterGain.connect(context.destination);

  const firstOscillator = context.createOscillator();
  firstOscillator.type = 'sine';
  firstOscillator.frequency.setValueAtTime(880, now);
  firstOscillator.connect(masterGain);
  firstOscillator.start(now);
  firstOscillator.stop(now + 0.16);

  const secondOscillator = context.createOscillator();
  secondOscillator.type = 'sine';
  secondOscillator.frequency.setValueAtTime(1174, now + 0.18);
  secondOscillator.connect(masterGain);
  secondOscillator.start(now + 0.18);
  secondOscillator.stop(now + 0.38);

  window.setTimeout(() => {
    context.close().catch(() => undefined);
  }, 700);
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const unreadCountRef = useRef<number | null>(null);
  const audioAllowedRef = useRef(false);

  const { data } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => notificationsApi.getUnreadCount(),
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const unlockAudio = () => {
      audioAllowedRef.current = true;
    };

    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio);

    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const unreadCount = data?.unreadCount ?? 0;

  useEffect(() => {
    const previousUnreadCount = unreadCountRef.current;
    unreadCountRef.current = unreadCount;

    if (previousUnreadCount === null) {
      return;
    }

    if (unreadCount > previousUnreadCount && audioAllowedRef.current) {
      playNotificationSound();
    }
  }, [unreadCount]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10 dark:hover:text-blue-200"
        title="Центр уведомлений"
        aria-label="Центр уведомлений"
      >
        <Bell className="h-5 w-5" />
        <span className="hidden text-sm font-medium md:inline">Уведомления</span>
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-[1.35rem] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {mounted && open && createPortal(
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <div className="app-modal-backdrop" onClick={() => setOpen(false)} />
          <div
            className="app-modal-panel relative z-10 flex max-h-[calc(100vh-32px)] w-[min(1320px,calc(100vw-32px))] flex-col overflow-hidden sm:max-h-[calc(100vh-48px)] sm:w-[min(1360px,calc(100vw-48px))]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="app-modal-header">
              <div>
                <div className="page-kicker mb-2">Коммуникации</div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Уведомления</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Изменения по карточкам и обращениям без перехода на отдельную страницу.
                </p>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setOpen(false)}
                title="Закрыть"
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="app-modal-body overflow-y-auto pt-0">
              <NotificationsCenterContent compact onNavigate={() => setOpen(false)} />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
