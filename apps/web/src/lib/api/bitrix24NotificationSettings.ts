import { apiClient } from './client';

export interface Bitrix24NotificationSettingsItem {
  isEnabled: boolean;
  webhookUrl: string;
  messagePrefix: string;
  updatedAt?: string | null;
  updatedBy?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

export interface UpdateBitrix24NotificationSettingsDto {
  isEnabled: boolean;
  webhookUrl?: string;
  messagePrefix?: string;
}

export interface TestBitrix24NotificationSettingsDto {
  webhookUrl?: string;
}

export const bitrix24NotificationSettingsApi = {
  get: async () => {
    const { data } = await apiClient.get('/bitrix24-notification-settings');
    return data as Bitrix24NotificationSettingsItem;
  },

  update: async (dto: UpdateBitrix24NotificationSettingsDto) => {
    const { data } = await apiClient.patch('/bitrix24-notification-settings', dto);
    return data as Bitrix24NotificationSettingsItem;
  },

  testConnection: async (dto: TestBitrix24NotificationSettingsDto) => {
    const { data } = await apiClient.post('/bitrix24-notification-settings/test', dto);
    return data as { success: boolean; message: string };
  },
};
