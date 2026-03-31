import { apiClient } from './client';

export interface AdminRequestLinkItem {
  id: string;
  url: string;
  createdAt: string;
}

export interface AdminRequestUserSummary {
  id: string;
  fullName: string;
  email: string;
}

export interface AdminRequestItem {
  id: string;
  publicId: string;
  description: string;
  status: 'NEW' | 'DONE';
  completionComment?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: AdminRequestUserSummary;
  completedBy?: AdminRequestUserSummary | null;
  links: AdminRequestLinkItem[];
}

export const adminRequestsApi = {
  getAll: async (params: { status?: 'NEW' | 'DONE'; page?: number; limit?: number } = {}) => {
    const { data } = await apiClient.get('/admin-requests', { params });
    return data as {
      items: AdminRequestItem[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  },

  create: async (dto: { description: string; links?: string[] }) => {
    const { data } = await apiClient.post('/admin-requests', dto);
    return data as AdminRequestItem;
  },

  complete: async (id: string, dto: { completionComment?: string }) => {
    const { data } = await apiClient.patch(`/admin-requests/${id}/complete`, dto);
    return data as AdminRequestItem;
  },
};
