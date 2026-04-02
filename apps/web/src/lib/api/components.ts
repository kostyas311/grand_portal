import { apiClient } from './client';

export interface ComponentItem {
  id: string;
  publicId: string;
  name: string;
  description?: string | null;
  location: string;
  isArchived: boolean;
  createdById: string;
  updatedById?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    fullName: string;
    email?: string;
  };
  updatedBy?: {
    id: string;
    fullName: string;
  } | null;
  _count?: {
    cardLinks: number;
    dataSourceLinks: number;
  };
}

export const componentsApi = {
  getAll: async (search?: string, includeArchived?: boolean) => {
    const { data } = await apiClient.get('/components', {
      params: { search, includeArchived },
    });
    return data as ComponentItem[];
  },

  getAvailable: async (search?: string) => {
    const { data } = await apiClient.get('/components/available', {
      params: { search },
    });
    return data as ComponentItem[];
  },

  getById: async (id: string) => {
    const { data } = await apiClient.get(`/components/${id}`);
    return data as ComponentItem;
  },

  create: async (dto: { name: string; description?: string; location: string }) => {
    const { data } = await apiClient.post('/components', dto);
    return data as ComponentItem;
  },

  update: async (id: string, dto: { name?: string; description?: string; location?: string }) => {
    const { data } = await apiClient.patch(`/components/${id}`, dto);
    return data as ComponentItem;
  },

  toggleArchive: async (id: string) => {
    const { data } = await apiClient.patch(`/components/${id}/archive`);
    return data as ComponentItem;
  },

  delete: async (id: string) => {
    const { data } = await apiClient.delete(`/components/${id}`);
    return data;
  },

  getCardComponents: async (cardId: string) => {
    const { data } = await apiClient.get(`/cards/${cardId}/components`);
    return data as Array<{
      id: string;
      createdAt: string;
      component: ComponentItem;
    }>;
  },

  attachToCard: async (cardId: string, componentId: string) => {
    const { data } = await apiClient.post(`/cards/${cardId}/components/${componentId}`);
    return data;
  },

  detachFromCard: async (cardId: string, componentId: string) => {
    const { data } = await apiClient.delete(`/cards/${cardId}/components/${componentId}`);
    return data;
  },

  getDataSourceComponents: async (id: string) => {
    const { data } = await apiClient.get(`/data-sources/${id}/components`);
    return data as Array<{
      id: string;
      createdAt: string;
      component: ComponentItem;
    }>;
  },

  attachToDataSource: async (id: string, componentId: string) => {
    const { data } = await apiClient.post(`/data-sources/${id}/components/${componentId}`);
    return data;
  },

  detachFromDataSource: async (id: string, componentId: string) => {
    const { data } = await apiClient.delete(`/data-sources/${id}/components/${componentId}`);
    return data;
  },
};
