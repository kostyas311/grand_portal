'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Sidebar } from './Sidebar';
import { useAuthStore, SESSION_TIMEOUT_MS } from '@/lib/store/auth.store';
import { authApi } from '@/lib/api';
import { setAccessToken, getAccessToken } from '@/lib/api/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const { isAuthenticated, user, lastActivity, setUser, logout } = useAuthStore();

  const [tokenReady, setTokenReady] = useState(() => !!getAccessToken());

  useEffect(() => {
    if (getAccessToken()) {
      return;
    }

    // Check 30-minute inactivity before attempting refresh
    if (lastActivity !== null && Date.now() - lastActivity > SESSION_TIMEOUT_MS) {
      logout();
      router.push('/login');
      return;
    }

    axios
      .post(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
      .then(async ({ data }) => {
        setAccessToken(data.accessToken);
        if (!user) {
          const u = await authApi.me();
          setUser(u);
        }
        setTokenReady(true);
      })
      .catch(() => {
        logout();
        router.push('/login');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!tokenReady) {
    return (
      <div className="min-h-screen bg-[#eff4f8] flex items-center justify-center">
        <div className="text-gray-400 text-sm">Загрузка...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="main-content flex-1">
        {children}
      </main>
    </div>
  );
}
