export { apiClient, setAccessToken, getAccessToken } from './client';
export { authApi } from './auth';
export { cardsApi } from './cards';
export { notificationsApi } from './notifications';
export { adminRequestsApi } from './adminRequests';
export { notificationEmailSettingsApi } from './notificationEmailSettings';
export { bitrix24NotificationSettingsApi } from './bitrix24NotificationSettings';

import { apiClient } from './client';

export const usersApi = {
  getAll: async (search?: string) => {
    const { data } = await apiClient.get('/users', { params: { search } });
    return data;
  },
  getDirectory: async () => {
    const { data } = await apiClient.get('/users/directory');
    return data;
  },
  getById: async (id: string) => {
    const { data } = await apiClient.get(`/users/${id}`);
    return data;
  },
  create: async (dto: any) => {
    const { data } = await apiClient.post('/users', dto);
    return data;
  },
  update: async (id: string, dto: any) => {
    const { data } = await apiClient.patch(`/users/${id}`, dto);
    return data;
  },
  toggleActive: async (id: string) => {
    const { data } = await apiClient.patch(`/users/${id}/toggle-active`);
    return data;
  },
  resetPassword: async (id: string, newPassword: string) => {
    const { data } = await apiClient.patch(`/users/${id}/reset-password`, { newPassword });
    return data;
  },
  delete: async (id: string) => {
    const { data } = await apiClient.delete(`/users/${id}`);
    return data;
  },
  updateProfile: async (dto: { fullName?: string; position?: string; phone?: string; password?: string }) => {
    const { data } = await apiClient.patch('/users/profile', dto);
    return data;
  },
};

export const dataSourcesApi = {
  getAll: async (search?: string, includeArchived?: boolean) => {
    const { data } = await apiClient.get('/data-sources', {
      params: { search, includeArchived },
    });
    return data;
  },
  getById: async (id: string) => {
    const { data } = await apiClient.get(`/data-sources/${id}`);
    return data;
  },
  create: async (dto: { name: string; description?: string; website?: string }) => {
    const { data } = await apiClient.post('/data-sources', dto);
    return data;
  },
  update: async (id: string, dto: { name?: string; description?: string; website?: string }) => {
    const { data } = await apiClient.patch(`/data-sources/${id}`, dto);
    return data;
  },
  toggleArchive: async (id: string) => {
    const { data } = await apiClient.patch(`/data-sources/${id}/archive`);
    return data;
  },
  delete: async (id: string) => {
    const { data } = await apiClient.delete(`/data-sources/${id}`);
    return data;
  },
};

export const materialsApi = {
  getAll: async (cardId: string) => {
    const { data } = await apiClient.get(`/cards/${cardId}/materials`);
    return data;
  },
  add: async (cardId: string, formData: FormData) => {
    const { data } = await apiClient.post(`/cards/${cardId}/materials`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
  downloadUrl: (cardId: string, materialId: string) =>
    `${process.env.NEXT_PUBLIC_API_URL || '/api'}/cards/${cardId}/materials/${materialId}/download`,
  downloadAllUrl: (cardId: string) =>
    `${process.env.NEXT_PUBLIC_API_URL || '/api'}/cards/${cardId}/materials/download-all`,
  delete: async (cardId: string, materialId: string) => {
    const { data } = await apiClient.delete(`/cards/${cardId}/materials/${materialId}`);
    return data;
  },
};

export const resultsApi = {
  getVersions: async (cardId: string) => {
    const { data } = await apiClient.get(`/cards/${cardId}/results`);
    return data;
  },
  createVersion: async (cardId: string, formData: FormData) => {
    const { data } = await apiClient.post(`/cards/${cardId}/results`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
  downloadVersionAllUrl: (cardId: string, versionId: string) =>
    `${process.env.NEXT_PUBLIC_API_URL || '/api'}/cards/${cardId}/results/${versionId}/download-all`,
  downloadItemUrl: (cardId: string, versionId: string, itemId: string) =>
    `${process.env.NEXT_PUBLIC_API_URL || '/api'}/cards/${cardId}/results/${versionId}/items/${itemId}/download`,
};

export const commentsApi = {
  getAll: async (cardId: string) => {
    const { data } = await apiClient.get(`/cards/${cardId}/comments`);
    return data;
  },
  create: async (cardId: string, dto: { text: string; resultVersionId?: string }) => {
    const { data } = await apiClient.post(`/cards/${cardId}/comments`, dto);
    return data;
  },
  delete: async (cardId: string, commentId: string) => {
    const { data } = await apiClient.delete(`/cards/${cardId}/comments/${commentId}`);
    return data;
  },
};

export const historyApi = {
  getByCard: async (cardId: string) => {
    const { data } = await apiClient.get(`/cards/${cardId}/history`);
    return data;
  },
};
