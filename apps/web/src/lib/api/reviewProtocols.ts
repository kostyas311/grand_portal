import { apiClient } from './client';

export interface ReviewProtocolItem {
  id: string;
  text: string;
  sortOrder: number;
  isChecked?: boolean;
  checkedAt?: string | null;
  checkedBy?: {
    id: string;
    fullName: string;
  } | null;
}

export interface ReviewProtocol {
  id: string;
  publicId: string;
  title: string;
  description?: string | null;
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
  items: ReviewProtocolItem[];
}

export interface CardReviewProtocol {
  id: string;
  cardId: string;
  sourceProtocol?: {
    id: string;
    publicId: string;
    title: string;
  } | null;
  title: string;
  description?: string | null;
  items: ReviewProtocolItem[];
}

export const reviewProtocolsApi = {
  getAll: async (search?: string, includeArchived?: boolean) => {
    const { data } = await apiClient.get('/review-protocols', {
      params: { search, includeArchived },
    });
    return data as ReviewProtocol[];
  },

  getAvailable: async (search?: string) => {
    const { data } = await apiClient.get('/review-protocols/available', {
      params: { search },
    });
    return data as ReviewProtocol[];
  },

  getById: async (id: string) => {
    const { data } = await apiClient.get(`/review-protocols/${id}`);
    return data as ReviewProtocol;
  },

  create: async (dto: { title: string; description?: string; items: Array<{ text: string; sortOrder?: number }> }) => {
    const { data } = await apiClient.post('/review-protocols', dto);
    return data as ReviewProtocol;
  },

  update: async (id: string, dto: { title?: string; description?: string; items?: Array<{ text: string; sortOrder?: number }> }) => {
    const { data } = await apiClient.patch(`/review-protocols/${id}`, dto);
    return data as ReviewProtocol;
  },

  toggleArchive: async (id: string) => {
    const { data } = await apiClient.patch(`/review-protocols/${id}/archive`);
    return data as ReviewProtocol;
  },

  delete: async (id: string) => {
    const { data } = await apiClient.delete(`/review-protocols/${id}`);
    return data;
  },

  getCardProtocol: async (cardId: string) => {
    const { data } = await apiClient.get(`/cards/${cardId}/review-protocol`);
    return data as CardReviewProtocol | null;
  },

  attachToCard: async (cardId: string, protocolId: string) => {
    const { data } = await apiClient.post(`/cards/${cardId}/review-protocol/${protocolId}`);
    return data as CardReviewProtocol;
  },

  detachFromCard: async (cardId: string) => {
    const { data } = await apiClient.delete(`/cards/${cardId}/review-protocol`);
    return data;
  },

  toggleCardItem: async (cardId: string, itemId: string) => {
    const { data } = await apiClient.patch(`/cards/${cardId}/review-protocol/items/${itemId}/toggle`);
    return data as ReviewProtocolItem;
  },

  getDataSourceProtocol: async (id: string) => {
    const { data } = await apiClient.get(`/data-sources/${id}/review-protocol`);
    return data as ReviewProtocol | null;
  },

  attachToDataSource: async (id: string, protocolId: string) => {
    const { data } = await apiClient.post(`/data-sources/${id}/review-protocol/${protocolId}`);
    return data;
  },

  detachFromDataSource: async (id: string) => {
    const { data } = await apiClient.delete(`/data-sources/${id}/review-protocol`);
    return data;
  },
};
