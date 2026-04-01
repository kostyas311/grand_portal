'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, Mail, PlugZap, Save, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/shared/EmptyState';
import { notificationEmailSettingsApi } from '@/lib/api';
import { formatDate, formatRelative } from '@/lib/utils';
import { useAuthStore } from '@/lib/store/auth.store';

type SettingsForm = {
  isEnabled: boolean;
  host: string;
  port: string;
  secure: boolean;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
};

export default function AdminNotificationsPage() {
  const { user } = useAuthStore();
  const [form, setForm] = useState<SettingsForm>({
    isEnabled: false,
    host: '',
    port: '587',
    secure: false,
    username: '',
    password: '',
    fromEmail: '',
    fromName: '',
    replyTo: '',
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notification-email-settings'],
    queryFn: () => notificationEmailSettingsApi.get(),
    enabled: user?.role === 'ADMIN',
  });

  useEffect(() => {
    if (!data) {
      return;
    }

    setForm({
      isEnabled: data.isEnabled,
      host: data.host || '',
      port: String(data.port || 587),
      secure: data.secure,
      username: data.username || '',
      password: '',
      fromEmail: data.fromEmail || '',
      fromName: data.fromName || '',
      replyTo: data.replyTo || '',
    });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () =>
      notificationEmailSettingsApi.update({
        isEnabled: form.isEnabled,
        host: form.host || undefined,
        port: form.port ? Number(form.port) : undefined,
        secure: form.secure,
        username: form.username || undefined,
        password: form.password || undefined,
        fromEmail: form.fromEmail || undefined,
        fromName: form.fromName || undefined,
        replyTo: form.replyTo || undefined,
      }),
    onSuccess: async () => {
      toast.success('Настройки email-уведомлений сохранены');
      await refetch();
      setForm((prev) => ({ ...prev, password: '' }));
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Не удалось сохранить настройки');
    },
  });

  const testMutation = useMutation({
    mutationFn: async () =>
      notificationEmailSettingsApi.testConnection({
        host: form.host || undefined,
        port: form.port ? Number(form.port) : undefined,
        secure: form.secure,
        username: form.username || undefined,
        password: form.password || undefined,
      }),
    onSuccess: (result) => {
      toast.success(result.message || 'Соединение с почтовым сервером успешно установлено');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Не удалось установить соединение с почтовым сервером');
    },
  });

  if (user?.role !== 'ADMIN') {
    return (
      <AppLayout>
        <div className="page-container">
          <div className="card">
            <EmptyState
              icon={ShieldCheck}
              title="Раздел доступен только администратору"
              description="Настройка почтового сервера для рассылки уведомлений доступна только в режиме администратора."
            />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="page-container">
        <div className="page-hero">
          <div className="page-hero-body">
            <div className="page-title-row">
              <div className="flex-1 min-w-0">
                <div className="page-kicker">Администрирование</div>
                <h1 className="mt-4 text-2xl font-semibold text-slate-900">Email-уведомления</h1>
                <p className="page-subtitle">
                  Настройка SMTP-сервера для отправки накопленных уведомлений пользователям системы.
                </p>
              </div>

              <div className="card-action-toolbar">
                <button
                  className="toolbar-button toolbar-button-secondary"
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
                  className="toolbar-button toolbar-button-primary"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || testMutation.isPending || isLoading}
                >
                  <Save className="w-4 h-4" />
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="font-medium text-gray-700">SMTP-сервер</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Эти настройки используются для отправки всех накопленных уведомлений на email активных пользователей.
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
                  <div className="font-medium text-gray-800">Включить email-рассылку уведомлений</div>
                  <div className="text-sm text-gray-500 mt-1">
                    После включения уведомления из центра уведомлений будут дополнительно отправляться на email пользователей.
                  </div>
                </div>
              </label>

              <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                Перед сохранением нажмите <span className="font-semibold">Тест соединения</span>, чтобы проверить доступность SMTP-сервера с текущими параметрами. Для порта <span className="font-semibold">465</span> обычно используют SSL/TLS, для <span className="font-semibold">587</span> чаще нужен TLS/STARTTLS.
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label label-required">SMTP-сервер</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="smtp.company.ru"
                    value={form.host}
                    onChange={(e) => setForm((prev) => ({ ...prev, host: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label label-required">Порт</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="587"
                    value={form.port}
                    onChange={(e) => setForm((prev) => ({ ...prev, port: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Логин SMTP</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="mailer@company.ru"
                    value={form.username}
                    onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Пароль SMTP</label>
                  <input
                    type="password"
                    className="input"
                    placeholder={data?.hasPassword ? 'Оставьте пустым, чтобы не менять' : 'Введите пароль'}
                    value={form.password}
                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  />
                  {data?.hasPassword && (
                    <p className="text-xs text-gray-400 mt-1">Текущий пароль уже сохранён в системе.</p>
                  )}
                </div>
                <div>
                  <label className="label label-required">Email отправителя</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="notifications@company.ru"
                    value={form.fromEmail}
                    onChange={(e) => setForm((prev) => ({ ...prev, fromEmail: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Имя отправителя</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="NormBase Portal"
                    value={form.fromName}
                    onChange={(e) => setForm((prev) => ({ ...prev, fromName: e.target.value }))}
                  />
                </div>
                <div className="col-span-2">
                  <label className="label">Reply-To</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="support@company.ru"
                    value={form.replyTo}
                    onChange={(e) => setForm((prev) => ({ ...prev, replyTo: e.target.value }))}
                  />
                </div>
              </div>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={form.secure}
                  onChange={(e) => setForm((prev) => ({ ...prev, secure: e.target.checked }))}
                />
                <span className="text-sm text-gray-700">Использовать шифрование (SSL/TLS или STARTTLS)</span>
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <div className="card">
              <div className="card-body">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${data?.isEnabled ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Текущий статус</div>
                    <div className="font-semibold text-gray-800">
                      {data?.isEnabled ? 'Email-рассылка включена' : 'Email-рассылка выключена'}
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
      </div>
    </AppLayout>
  );
}
