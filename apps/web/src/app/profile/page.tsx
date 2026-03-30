'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, User } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { usersApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store/auth.store';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Администратор системы',
  MANAGER: 'Руководитель',
  USER: 'Пользователь',
};

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [position, setPosition] = useState(user?.position || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const profileMutation = useMutation({
    mutationFn: (dto: { fullName?: string; position?: string; phone?: string; password?: string }) =>
      usersApi.updateProfile(dto),
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      toast.success('Профиль обновлён');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Ошибка'),
  });

  const handleSave = () => {
    const dto: any = {};
    if (fullName !== user?.fullName) dto.fullName = fullName;
    if (position !== (user?.position || '')) dto.position = position;
    if (phone !== (user?.phone || '')) dto.phone = phone;
    if (newPassword) {
      if (newPassword !== confirmPassword) {
        toast.error('Пароли не совпадают');
        return;
      }
      if (newPassword.length < 6) {
        toast.error('Пароль должен быть не менее 6 символов');
        return;
      }
      dto.password = newPassword;
    }
    if (Object.keys(dto).length === 0) {
      toast.info('Изменений нет');
      return;
    }
    profileMutation.mutate(dto);
  };

  return (
    <AppLayout>
      <div className="page-container max-w-lg">
        <div className="page-header">
          <h1 className="section-title">Мой профиль</h1>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-lg">
                  {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <div>
                <div className="font-semibold text-gray-800">{user?.fullName}</div>
                <div className="text-sm text-gray-500">{user?.email}</div>
                <div className="text-xs text-gray-400">
                  {user?.role ? (ROLE_LABELS[user.role] || user.role) : ''}
                </div>
              </div>
            </div>
          </div>

          <div className="card-body space-y-4">
            <div>
              <label className="label label-required">ФИО</label>
              <input
                type="text"
                className="input"
                value={fullName}
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
                onChange={(e) => setPosition(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Номер телефона</label>
              <input
                type="tel"
                className="input"
                placeholder="+7 (___) ___-__-__"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Email</label>
              <input type="email" className="input bg-gray-50" value={user?.email || ''} disabled />
              <p className="text-xs text-gray-400 mt-1">Email изменить нельзя</p>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <h3 className="font-medium text-gray-700 mb-3">Изменить пароль</h3>
              <div className="space-y-3">
                <div>
                  <label className="label">Новый пароль</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="Оставьте пустым, если не хотите менять"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                {newPassword && (
                  <div>
                    <label className="label">Подтверждение пароля</label>
                    <input
                      type="password"
                      className={`input ${confirmPassword && confirmPassword !== newPassword ? 'input-error' : ''}`}
                      placeholder="Повторите новый пароль"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    {confirmPassword && confirmPassword !== newPassword && (
                      <p className="error-message">Пароли не совпадают</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2">
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={profileMutation.isPending}
              >
                {profileMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Сохранение...</>
                ) : 'Сохранить изменения'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
