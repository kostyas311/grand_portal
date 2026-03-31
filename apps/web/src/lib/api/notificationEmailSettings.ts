import { apiClient } from './client';

export interface NotificationEmailSettingsItem {
  isEnabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  hasPassword: boolean;
  updatedAt?: string | null;
  updatedBy?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

export interface UpdateNotificationEmailSettingsDto {
  isEnabled: boolean;
  host?: string;
  port?: number;
  secure: boolean;
  username?: string;
  password?: string;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
}

export interface TestNotificationEmailSettingsDto {
  host?: string;
  port?: number;
  secure: boolean;
  username?: string;
  password?: string;
}

export const notificationEmailSettingsApi = {
  get: async () => {
    const { data } = await apiClient.get('/notification-email-settings');
    return data as NotificationEmailSettingsItem;
  },

  update: async (dto: UpdateNotificationEmailSettingsDto) => {
    const { data } = await apiClient.patch('/notification-email-settings', dto);
    return data as NotificationEmailSettingsItem;
  },

  testConnection: async (dto: TestNotificationEmailSettingsDto) => {
    const { data } = await apiClient.post('/notification-email-settings/test', dto);
    return data as { success: boolean; message: string };
  },
};
