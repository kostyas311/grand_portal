'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import Image from 'next/image';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { authApi } from '@/lib/api/auth';
import { setAccessToken } from '@/lib/api/client';
import { useAuthStore } from '@/lib/store/auth.store';

const schema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(1, 'Введите пароль'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const { accessToken } = await authApi.login(data.email, data.password);
      setAccessToken(accessToken);
      const user = await authApi.me();
      setAuth(user, accessToken);
      router.push('/dashboard');
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Ошибка входа';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eff4f8] flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center">
        <div className="flex items-center gap-3 mb-2">
          <Image src="/logo.png" alt="Логотип" width={48} height={48} className="object-contain" />
          <span className="text-2xl font-bold text-[#1e3a5f]">Управление сметно-нормативной документацией</span>
        </div>
        <p className="text-sm text-gray-500">Внутренний портал документооборота</p>
      </div>

      {/* Login card */}
      <div className="w-full max-w-sm bg-white shadow-card border border-gray-200 rounded-sm">
        <div className="px-8 py-8">
          <h1 className="text-xl font-semibold text-gray-800 mb-6">Вход в систему</h1>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                {...register('email')}
                type="email"
                className={`input ${errors.email ? 'input-error' : ''}`}
                placeholder="user@company.ru"
                autoComplete="email"
              />
              {errors.email && (
                <p className="error-message">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="label">Пароль</label>
              <input
                {...register('password')}
                type="password"
                className={`input ${errors.password ? 'input-error' : ''}`}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              {errors.password && (
                <p className="error-message">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Выполняется вход...
                </>
              ) : (
                'Войти'
              )}
            </button>
          </form>
        </div>
      </div>

      <p className="mt-6 text-xs text-gray-400">
        Доступ только для сотрудников организации
      </p>
    </div>
  );
}
