'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Lock, Unlock, Key, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { usersApi } from '@/lib/api';
import { formatDate, formatRelative } from '@/lib/utils';
import { useAuthStore } from '@/lib/store/auth.store';

export default function AdminUsersPage() {
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ fullName: '', email: '', password: '', role: 'USER' });
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ['users', search],
    queryFn: () => usersApi.getAll(search),
  });

  const createMutation = useMutation({
    mutationFn: () => usersApi.create(newUser),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Пользователь создан');
      setShowCreate(false);
      setNewUser({ fullName: '', email: '', password: '', role: 'USER' });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Ошибка'),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => usersApi.toggleActive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Статус пользователя изменён');
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      usersApi.resetPassword(id, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Пароль сброшен');
      setResetPasswordUserId(null);
      setNewPassword('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Ошибка'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Пользователь удалён');
      setDeleteUserId(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Ошибка'),
  });

  return (
    <AppLayout>
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1 className="section-title">Управление пользователями</h1>
            <p className="text-sm text-gray-500 mt-0.5">Создание и управление учётными записями</p>
          </div>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" />
            Создать пользователя
          </button>
        </div>

        {/* Search */}
        <div className="card mb-4">
          <div className="card-body">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск по имени или email..."
                className="input pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="card mb-4">
            <div className="card-header">
              <h2 className="font-medium text-gray-700">Новый пользователь</h2>
            </div>
            <div className="card-body space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label label-required">ФИО</label>
                  <input type="text" className="input" placeholder="Иванов Иван Иванович"
                    value={newUser.fullName} onChange={e => setNewUser(p => ({ ...p, fullName: e.target.value }))} />
                </div>
                <div>
                  <label className="label label-required">Email</label>
                  <input type="email" className="input" placeholder="user@company.ru"
                    value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div>
                  <label className="label label-required">Пароль</label>
                  <input type="password" className="input" placeholder="Минимум 6 символов"
                    value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Роль</label>
                  <select className="input" value={newUser.role}
                    onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}>
                    <option value="USER">Пользователь</option>
                    <option value="MANAGER">Руководитель</option>
                    <option value="ADMIN">Администратор</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn-primary"
                  disabled={!newUser.fullName || !newUser.email || !newUser.password}
                  onClick={() => createMutation.mutate()}>
                  Создать
                </button>
                <button className="btn-secondary" onClick={() => setShowCreate(false)}>Отмена</button>
              </div>
            </div>
          </div>
        )}

        {/* Users table */}
        <div className="card">
          {isLoading ? (
            <div className="card-body space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-12" />)}
            </div>
          ) : !users?.length ? (
            <EmptyState icon={Users} title="Пользователи не найдены" />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>ФИО</th>
                  <th>Email</th>
                  <th>Роль</th>
                  <th>Статус</th>
                  <th>Последний вход</th>
                  <th>Создан</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.id} className={!u.isActive ? 'opacity-50' : ''}>
                    <td className="font-medium text-gray-800">{u.fullName}</td>
                    <td className="text-gray-500 text-sm">{u.email}</td>
                    <td>
                      <span className={`badge ${u.role === 'ADMIN' ? 'badge-review' : u.role === 'MANAGER' ? 'badge-in-progress' : 'badge-new'}`}>
                        {u.role === 'ADMIN' ? 'Администратор' : u.role === 'MANAGER' ? 'Руководитель' : 'Пользователь'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.isActive ? 'badge-done' : 'badge-cancelled'}`}>
                        {u.isActive ? 'Активен' : 'Заблокирован'}
                      </span>
                    </td>
                    <td className="text-xs text-gray-400">
                      {u.lastLoginAt ? formatRelative(u.lastLoginAt) : 'Не входил'}
                    </td>
                    <td className="text-xs text-gray-400">{formatDate(u.createdAt)}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        {u.id !== currentUser?.id && (
                          <>
                            <button
                              className="btn-icon"
                              title={u.isActive ? 'Заблокировать' : 'Разблокировать'}
                              onClick={() => toggleMutation.mutate(u.id)}
                            >
                              {u.isActive ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                            </button>
                            <button
                              className="btn-icon"
                              title="Сбросить пароль"
                              onClick={() => setResetPasswordUserId(u.id)}
                            >
                              <Key className="w-4 h-4" />
                            </button>
                            <button
                              className="btn-icon text-red-400 hover:text-red-600 hover:bg-red-50"
                              title="Удалить"
                              onClick={() => setDeleteUserId(u.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {u.id === currentUser?.id && (
                          <span className="text-xs text-gray-400">Вы</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Reset password dialog */}
      {resetPasswordUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setResetPasswordUserId(null)} />
          <div className="relative bg-white rounded-sm shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="font-semibold mb-4">Сброс пароля</h3>
            <div className="mb-4">
              <label className="label label-required">Новый пароль</label>
              <input
                type="password"
                className="input"
                placeholder="Минимум 6 символов"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary" onClick={() => setResetPasswordUserId(null)}>Отмена</button>
              <button
                className="btn-primary"
                disabled={newPassword.length < 6 || resetPasswordMutation.isPending}
                onClick={() => resetPasswordMutation.mutate({ id: resetPasswordUserId, password: newPassword })}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={!!deleteUserId}
        title="Удалить пользователя?"
        description="Это действие нельзя отменить. Все данные пользователя будут удалены."
        confirmLabel="Удалить"
        onConfirm={() => deleteUserId && deleteMutation.mutate(deleteUserId)}
        onCancel={() => setDeleteUserId(null)}
        loading={deleteMutation.isPending}
      />
    </AppLayout>
  );
}
