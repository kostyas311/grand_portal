'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { authApi } from '@/lib/api/auth';
import { setAccessToken } from '@/lib/api/client';
import { useAuthStore } from '@/lib/store/auth.store';
import { BrandBlock } from '@/components/shared/BrandBlock';

const schema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(1, 'Введите пароль'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

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
      <div className="mb-8 w-full max-w-xl">
        <BrandBlock variant="auth" />
      </div>

      {/* Login card */}
      <div className="w-full max-w-sm bg-white shadow-card border border-gray-200 rounded-sm">
        <div className="px-8 py-8">
          <h1 className="text-xl font-semibold text-gray-800 mb-6">Вход в систему</h1>

          {!isHydrated ? (
            <div className="space-y-4">
              <div>
                <label className="label">Email</label>
                <div className="input bg-gray-50 text-gray-400">Загрузка формы...</div>
              </div>
              <div>
                <label className="label">Пароль</label>
                <div className="input bg-gray-50 text-gray-400">Загрузка формы...</div>
              </div>
              <button
                type="button"
                disabled
                className="btn-primary w-full justify-center mt-2 opacity-60 cursor-not-allowed"
              >
                Подготовка...
              </button>
            </div>
          ) : (
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
          )}
        </div>
      </div>

      <p className="mt-6 text-xs text-gray-400">
        Доступ только для сотрудников организации
      </p>
    </div>
  );
}
