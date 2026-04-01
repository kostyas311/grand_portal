import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setAccessToken } from '../api/client';

export const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: 'USER' | 'MANAGER' | 'ADMIN';
  themePreference?: 'LIGHT' | 'DARK';
  isActive: boolean;
  position?: string;
  phone?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  lastActivity: number | null;
  setUser: (user: User | null) => void;
  setAuth: (user: User, token: string) => void;
  updateActivity: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      lastActivity: null,

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      setAuth: (user, token) => {
        setAccessToken(token);
        set({ user, isAuthenticated: true, lastActivity: Date.now() });
      },

      updateActivity: () => set({ lastActivity: Date.now() }),

      logout: () => {
        setAccessToken(null);
        set({ user: null, isAuthenticated: false, lastActivity: null });
      },
    }),
    {
      name: 'normbase-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        lastActivity: state.lastActivity,
      }),
    },
  ),
);
