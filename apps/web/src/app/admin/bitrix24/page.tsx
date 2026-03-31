'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, Loader2, PlugZap, Save, Search, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/shared/EmptyState';
import { bitrix24NotificationSettingsApi, usersApi } from '@/lib/api';
import { formatDate, formatRelative } from '@/lib/utils';
import { useAuthStore } from '@/lib/store/auth.store';

type SettingsForm = {
  isEnabled: boolean;
  webhookUrl: string;
  messagePrefix: string;
};

export default function AdminBitrix24Page() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SettingsForm>({
    isEnabled: false,
    webhookUrl: '',
    messagePrefix: 'Нормбаза',
  });
  const [search, setSearch] = useState('');
  const [userMappings, setUserMappings] = useState<Record<string, string>>({});
  const [savingMappingId, setSavingMappingId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['bitrix24-notification-settings'],
    queryFn: () => bitrix24NotificationSettingsApi.get(),
    enabled: user?.role === 'ADMIN',
  });

  const { data: users, isLoading: isUsersLoading } = useQuery({
    queryKey: ['users', search, 'bitrix24-mapping'],
    queryFn: () => usersApi.getAll(search),
    enabled: user?.role === 'ADMIN',
  });

  useEffect(() => {
    if (!data) {
      return;
    }

    setForm({
      isEnabled: data.isEnabled,
      webhookUrl: data.webhookUrl || '',
      messagePrefix: data.messagePrefix || 'Нормбаза',
    });
  }, [data]);

  useEffect(() => {
    if (!users) {
      return;
    }

    setUserMappings(
      users.reduce((acc: Record<string, string>, current: any) => {
        acc[current.id] = current.bitrix24UserId || '';
        return acc;
      }, {}),
    );
  }, [users]);

  const saveMutation = useMutation({
    mutationFn: async () =>
      bitrix24NotificationSettingsApi.update({
        isEnabled: form.isEnabled,
        webhookUrl: form.webhookUrl || undefined,
        messagePrefix: form.messagePrefix || undefined,
      }),
    onSuccess: async () => {
      toast.success('Настройки Bitrix24 сохранены');
      await refetch();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Не удалось сохранить настройки');
    },
  });

  const testMutation = useMutation({
    mutationFn: async () =>
      bitrix24NotificationSettingsApi.testConnection({
        webhookUrl: form.webhookUrl || undefined,
      }),
    onSuccess: (result) => {
      toast.success(result.message || 'Соединение с Bitrix24 успешно установлено');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Не удалось установить соединение с Bitrix24');
    },
  });

  const saveMappingMutation = useMutation({
    mutationFn: async ({ id, bitrix24UserId }: { id: string; bitrix24UserId: string }) => {
      setSavingMappingId(id);
      return usersApi.update(id, { bitrix24UserId });
    },
    onSuccess: async (_, variables) => {
      toast.success('Сопоставление пользователя сохранено');
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      setSavingMappingId((current) => (current === variables.id ? null : current));
    },
    onError: (err: any, variables) => {
      setSavingMappingId((current) => (current === variables.id ? null : current));
      toast.error(err?.response?.data?.message || 'Не удалось сохранить сопоставление');
    },
  });

  const filteredUsers = useMemo(() => {
    return (users || []).filter((candidate: any) => candidate.isActive);
  }, [users]);

  if (user?.role !== 'ADMIN') {
    return (
      <AppLayout>
        <div className="page-container">
          <div className="card">
            <EmptyState
              icon={ShieldCheck}
              title="Раздел доступен только администратору"
              description="Настройка Bitrix24-уведомлений доступна только в режиме администратора."
            />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1 className="section-title">Bitrix24-уведомления</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Настройка канала уведомлений по карточкам и сопоставление пользователей с Bitrix24
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending || saveMutation.isPending || isLoading}
            >
              {testMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Проверка...
                </>
              ) : (
                <>
                  <PlugZap className="w-4 h-4" />
                  Тест соединения
                </>
              )}
            </button>
            <button
              className="btn-primary"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || testMutation.isPending || isLoading}
            >
              <Save className="w-4 h-4" />
              Сохранить
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="font-medium text-gray-700">Канал Bitrix24</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Канал используется только для отправки уведомлений пользователям по карточкам портала.
                </p>
              </div>
            </div>
            <div className="card-body space-y-5">
              <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={form.isEnabled}
                  onChange={(e) => setForm((prev) => ({ ...prev, isEnabled: e.target.checked }))}
                />
                <div>
                  <div className="font-medium text-gray-800">Включить Bitrix24-уведомления</div>
                  <div className="text-sm text-gray-500 mt-1">
                    После включения пользователи с заполненным ID Bitrix24 будут получать уведомления по карточкам в Bitrix24.
                  </div>
                </div>
              </label>

              <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                Сначала заполни URL входящего webhook Bitrix24, нажми <span className="font-semibold">Тест соединения</span>, а затем сохрани настройки.
              </div>

              <div className="space-y-4">
                <div>
                  <label className="label label-required">URL входящего webhook Bitrix24</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="https://<ваш-портал>.bitrix24.ru/rest/1/xxxxx/"
                    value={form.webhookUrl}
                    onChange={(e) => setForm((prev) => ({ ...prev, webhookUrl: e.target.value }))}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Указывай входящий webhook Bitrix24. Метод API система подставит сама.
                  </p>
                </div>

                <div>
                  <label className="label">Префикс сообщения</label>
                  <input
                    type="text"
                    className="input"
                    placeholder='Нормбаза'
                    value={form.messagePrefix}
                    onChange={(e) => setForm((prev) => ({ ...prev, messagePrefix: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="card">
              <div className="card-body">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${data?.isEnabled ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                    <BellRing className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Текущий статус</div>
                    <div className="font-semibold text-gray-800">
                      {data?.isEnabled ? 'Bitrix24-уведомления включены' : 'Bitrix24-уведомления выключены'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="font-medium text-gray-700">Последнее обновление</h2>
              </div>
              <div className="card-body text-sm text-gray-600">
                {data?.updatedAt ? (
                  <>
                    <div>Дата: <span className="font-medium text-gray-800">{formatDate(data.updatedAt)}</span></div>
                    <div className="mt-1">Относительно: <span className="font-medium text-gray-800">{formatRelative(data.updatedAt)}</span></div>
                    {data.updatedBy && (
                      <div className="mt-1">
                        Изменил: <span className="font-medium text-gray-800">{data.updatedBy.fullName}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div>Настройки ещё не сохранялись.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="card mt-4">
          <div className="card-header">
            <div>
              <h2 className="font-medium text-gray-700">Сопоставление пользователей</h2>
              <p className="text-sm text-gray-500 mt-1">
                Для доставки уведомлений укажи ID пользователя Bitrix24 для каждого сотрудника, который должен получать сообщения.
              </p>
            </div>
          </div>
          <div className="card-body space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск по имени или email..."
                className="input pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {isUsersLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="skeleton h-14" />
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <EmptyState
                icon={BellRing}
                title="Пользователи не найдены"
                description="Измените поисковый запрос или создайте пользователей в системе."
              />
            ) : (
              <div className="table-shell">
              <table className="w-full text-sm border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-[0.08em] bg-slate-50 border-b border-slate-200">Пользователь</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-[0.08em] bg-slate-50 border-b border-slate-200">Email</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-[0.08em] bg-slate-50 border-b border-slate-200">Роль</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-[0.08em] bg-slate-50 border-b border-slate-200 min-w-[260px]">ID Bitrix24</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-[0.08em] bg-slate-50 border-b border-slate-200 min-w-[180px]">Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((candidate: any) => {
                    const currentValue = userMappings[candidate.id] ?? '';
                    const unchanged = currentValue === (candidate.bitrix24UserId || '');

                    return (
                      <tr key={candidate.id}>
                        <td className="px-4 py-4 border-b border-slate-100 align-top font-medium text-gray-800">{candidate.fullName}</td>
                        <td className="px-4 py-4 border-b border-slate-100 align-top text-sm text-gray-500">{candidate.email}</td>
                        <td className="px-4 py-4 border-b border-slate-100 align-top">
                          <span className={`badge ${candidate.role === 'ADMIN' ? 'badge-review' : candidate.role === 'MANAGER' ? 'badge-in-progress' : 'badge-new'}`}>
                            {candidate.role === 'ADMIN' ? 'Администратор' : candidate.role === 'MANAGER' ? 'Руководитель' : 'Пользователь'}
                          </span>
                        </td>
                        <td className="px-4 py-4 border-b border-slate-100 align-top">
                          <div className="min-w-[220px]">
                            <input
                              type="text"
                              className="input"
                              placeholder="например, 17"
                              value={currentValue}
                              onChange={(e) =>
                                setUserMappings((prev) => ({
                                  ...prev,
                                  [candidate.id]: e.target.value,
                                }))
                              }
                            />
                          </div>
                        </td>
                        <td className="px-4 py-4 border-b border-slate-100 align-top">
                          <div className="w-[160px]">
                            <button
                              className="btn-secondary w-full justify-center"
                              disabled={unchanged || saveMappingMutation.isPending}
                              onClick={() =>
                                saveMappingMutation.mutate({
                                  id: candidate.id,
                                  bitrix24UserId: currentValue.trim(),
                                })
                              }
                            >
                              {savingMappingId === candidate.id ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Сохранение...
                                </>
                              ) : (
                                <>
                                  <Save className="w-4 h-4" />
                                  Сохранить
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
