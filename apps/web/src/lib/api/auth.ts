import { apiClient } from './client';

export const authApi = {
  login: async (email: string, password: string) => {
    const { data } = await apiClient.post('/auth/login', { email, password });
    return data;
  },

  refresh: async () => {
    const { data } = await apiClient.post('/auth/refresh');
    return data;
  },

  logout: async () => {
    await apiClient.post('/auth/logout');
  },

  me: async () => {
    const { data } = await apiClient.get('/auth/me');
    return data;
  },
};
