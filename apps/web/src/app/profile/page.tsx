'use client';

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, MoonStar, SunMedium } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { usersApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store/auth.store';

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '');

  let normalized = digits;
  if (normalized.startsWith('8')) {
    normalized = `7${normalized.slice(1)}`;
  }
  if (!normalized.startsWith('7')) {
    normalized = normalized ? `7${normalized}` : '';
  }

  const limited = normalized.slice(0, 11);
  const rest = limited.slice(1);

  if (!limited) {
    return '';
  }

  let result = '+7';
  if (rest.length > 0) result += ` (${rest.slice(0, 3)}`;
  if (rest.length >= 3) result += ')';
  if (rest.length > 3) result += ` ${rest.slice(3, 6)}`;
  if (rest.length > 6) result += `-${rest.slice(6, 8)}`;
  if (rest.length > 8) result += `-${rest.slice(8, 10)}`;

  return result;
}

function normalizePhoneForSave(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) {
    return '';
  }

  let normalized = digits;
  if (normalized.startsWith('8')) {
    normalized = `7${normalized.slice(1)}`;
  }
  if (!normalized.startsWith('7')) {
    normalized = `7${normalized}`;
  }

  return formatPhoneInput(normalized);
}

function isPhoneComplete(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length === 11;
}

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [position, setPosition] = useState(user?.position || '');
  const [phone, setPhone] = useState(normalizePhoneForSave(user?.phone || ''));
  const [themePreference, setThemePreference] = useState<'LIGHT' | 'DARK'>(user?.themePreference === 'DARK' ? 'DARK' : 'LIGHT');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const profileMutation = useMutation({
    mutationFn: (dto: { fullName?: string; position?: string; phone?: string }) =>
      usersApi.updateProfile(dto),
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      toast.success('Основные данные профиля обновлены');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Ошибка'),
  });

  const passwordMutation = useMutation({
    mutationFn: (dto: { password: string }) => usersApi.updateProfile(dto),
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Пароль успешно обновлён');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Ошибка'),
  });

  const themeMutation = useMutation({
    mutationFn: (dto: { themePreference: 'LIGHT' | 'DARK' }) => usersApi.updateProfile(dto),
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      setThemePreference(updatedUser.themePreference === 'DARK' ? 'DARK' : 'LIGHT');
      toast.success('Тема интерфейса обновлена');
    },
    onError: (err: any) => {
      setThemePreference(user?.themePreference === 'DARK' ? 'DARK' : 'LIGHT');
      toast.error(err?.response?.data?.message || 'Ошибка');
    },
  });

  const handleProfileSave = () => {
    const dto: any = {};
    if (fullName !== user?.fullName) dto.fullName = fullName;
    if (position !== (user?.position || '')) dto.position = position;
    const normalizedPhone = normalizePhoneForSave(phone);
    const currentPhone = normalizePhoneForSave(user?.phone || '');

    if (phone && !isPhoneComplete(phone)) {
      toast.error('Введите телефон полностью в формате +7 (XXX) XXX-XX-XX');
      return;
    }

    if (normalizedPhone !== currentPhone) dto.phone = normalizedPhone;

    if (Object.keys(dto).length === 0) {
      toast.info('Изменений нет');
      return;
    }
    profileMutation.mutate(dto);
  };

  const handlePasswordSave = () => {
    if (!newPassword) {
      toast.info('Введите новый пароль');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Пароли не совпадают');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Пароль должен быть не менее 6 символов');
      return;
    }

    passwordMutation.mutate({ password: newPassword });
  };

  const hasProfileChanges =
    fullName !== (user?.fullName || '') ||
    position !== (user?.position || '') ||
    normalizePhoneForSave(phone) !== normalizePhoneForSave(user?.phone || '');
  const hasThemeChanges = themePreference !== (user?.themePreference === 'DARK' ? 'DARK' : 'LIGHT');

  useEffect(() => {
    setThemePreference(user?.themePreference === 'DARK' ? 'DARK' : 'LIGHT');
  }, [user?.themePreference]);

  return (
    <AppLayout>
      <div className="page-container-wide">
        <div className="page-hero">
          <div className="page-hero-body">
            <div className="page-kicker">Личный кабинет</div>
            <div className="page-title-row">
              <div className="min-w-0 flex-1">
                <h1 className="section-title text-2xl md:text-[30px]">Мой профиль</h1>
                <p className="page-subtitle">
                  Управление персональными данными, оформлением и безопасностью учётной записи.
                </p>
              </div>

              <div className="meta-panel w-full xl:w-[340px] xl:flex-shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center shadow-sm">
                    <span className="text-xl font-bold">
                      {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 truncate">{user?.fullName}</div>
                    <div className="text-sm text-slate-500 truncate">{user?.position || 'Должность не указана'}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      {user?.phone || 'Телефон не указан'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_360px]">
          <div className="section-surface">
            <div className="section-surface-header">
              <div>
                <div className="section-surface-title">Основные данные</div>
                <div className="section-surface-subtitle">Эти поля можно обновить без изменения пароля</div>
              </div>
            </div>
            <div className="card-body space-y-5">
              <div className="form-grid-2">
                <div>
                  <label className="label label-required">ФИО</label>
                  <input
                    type="text"
                    className="input"
                    value={fullName}
                    autoComplete="name"
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">Должность</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Например: Ведущий специалист"
                    value={position}
                    autoComplete="organization-title"
                    onChange={(e) => setPosition(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div>
                  <label className="label">Номер телефона</label>
                  <input
                    type="tel"
                    className="input"
                    placeholder="+7 (___) ___-__-__"
                    value={phone}
                    autoComplete="tel"
                    inputMode="numeric"
                    onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                  />
                  <p className="text-xs text-gray-400 mt-1">Формат: +7 (XXX) XXX-XX-XX</p>
                </div>

                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    className="input bg-gray-50"
                    value={user?.email || ''}
                    autoComplete="email"
                    disabled
                  />
                  <p className="text-xs text-gray-400 mt-1">Email изменить нельзя</p>
                </div>
              </div>

              <div className="form-actions">
                <button
                  className="btn-primary"
                  onClick={handleProfileSave}
                  disabled={profileMutation.isPending || !hasProfileChanges}
                >
                  {profileMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Сохранение...
                    </>
                  ) : 'Сохранить данные'}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="section-surface">
              <div className="section-surface-header">
                <div>
                  <div className="section-surface-title">Оформление</div>
                  <div className="section-surface-subtitle">Выбери удобную тему интерфейса</div>
                </div>
              </div>

              <div className="card-body space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    className={`theme-choice ${themePreference === 'LIGHT' ? 'theme-choice-active' : ''}`}
                    onClick={() => setThemePreference('LIGHT')}
                  >
                    <SunMedium className="h-4 w-4" />
                    <span>Светлая тема</span>
                  </button>
                  <button
                    type="button"
                    className={`theme-choice ${themePreference === 'DARK' ? 'theme-choice-active' : ''}`}
                    onClick={() => setThemePreference('DARK')}
                  >
                    <MoonStar className="h-4 w-4" />
                    <span>Тёмная тема</span>
                  </button>
                </div>

                <div className="form-actions">
                  <button
                    className="btn-secondary"
                    onClick={() => themeMutation.mutate({ themePreference })}
                    disabled={themeMutation.isPending || !hasThemeChanges}
                  >
                    {themeMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Сохранение...
                      </>
                    ) : 'Сохранить тему'}
                  </button>
                </div>
              </div>
            </div>

            <div className="section-surface">
              <div className="section-surface-header">
                <div>
                  <div className="section-surface-title">Безопасность</div>
                </div>
              </div>

              <div className="card-body space-y-4">
                <div>
                  <label className="label">Новый пароль</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="Введите новый пароль"
                    value={newPassword}
                    autoComplete="new-password"
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">Подтверждение пароля</label>
                  <input
                    type="password"
                    className={`input ${confirmPassword && confirmPassword !== newPassword ? 'input-error' : ''}`}
                    placeholder="Повторите новый пароль"
                    value={confirmPassword}
                    autoComplete="new-password"
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  {confirmPassword && confirmPassword !== newPassword && (
                    <p className="error-message">Пароли не совпадают</p>
                  )}
                </div>

                <div className="form-actions">
                  <button
                    className="btn-secondary"
                    onClick={handlePasswordSave}
                    disabled={passwordMutation.isPending || !newPassword || !confirmPassword}
                  >
                    {passwordMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Обновление...
                      </>
                    ) : 'Обновить пароль'}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </AppLayout>
  );
}
