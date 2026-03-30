import { apiClient } from './client';

export interface CardsFilter {
  status?: string | string[];
  dataSourceId?: string;
  month?: number;
  year?: number;
  priority?: string;
  dueFilter?: 'overdue' | 'today' | 'next7' | 'next30' | 'none';
  dueDateFrom?: string;
  dueDateTo?: string;
  search?: string;
  myCards?: boolean;
  assignedToMe?: boolean;
  createdByMe?: boolean;
  isArchived?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const cardsApi = {
  getAll: async (filter: CardsFilter = {}) => {
    const { data } = await apiClient.get('/cards', { params: filter });
    return data;
  },

  getDone: async (filter: Omit<CardsFilter, 'myCards' | 'dueFilter' | 'isArchived' | 'status' | 'priority'> = {}) => {
    const { data } = await apiClient.get('/cards/done', { params: filter });
    return data;
  },

  getById: async (id: string) => {
    const { data } = await apiClient.get(`/cards/${id}`);
    return data;
  },

  create: async (dto: {
    dataSourceId?: string;
    extraTitle?: string;
    month: number;
    year: number;
    description?: string;
    priority?: string;
    dueDate?: string;
    executorId?: string;
    reviewerId?: string;
    parentId?: string;
  }) => {
    const { data } = await apiClient.post('/cards', dto);
    return data;
  },

  update: async (id: string, dto: Partial<{
    dataSourceId?: string;
    extraTitle: string;
    month: number;
    year: number;
    description: string;
    priority: string;
    dueDate: string;
  }>) => {
    const { data } = await apiClient.patch(`/cards/${id}`, dto);
    return data;
  },

  changeStatus: async (id: string, status: string, comment?: string, reason?: string, force?: boolean) => {
    const { data } = await apiClient.patch(`/cards/${id}/status`, { status, comment, reason, force });
    return data;
  },

  assign: async (id: string, dto: { executorId?: string | null; reviewerId?: string | null }) => {
    const { data } = await apiClient.patch(`/cards/${id}/assign`, dto);
    return data;
  },

  delete: async (id: string) => {
    const { data } = await apiClient.delete(`/cards/${id}`);
    return data;
  },

  getStats: async (filter: { month?: number; year?: number; dueDateFrom?: string; dueDateTo?: string } = {}) => {
    const { data } = await apiClient.get('/cards/stats', { params: filter });
    return data as Record<string, number>;
  },

  toggleWatch: async (id: string) => {
    const { data } = await apiClient.post(`/cards/${id}/watch`);
    return data as { watching: boolean };
  },

  getWatchStatus: async (id: string) => {
    const { data } = await apiClient.get(`/cards/${id}/watch`);
    return data as { watching: boolean; watcherCount: number };
  },
};
