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

export interface AdminRequestMessageItem {
  id: string;
  text: string;
  createdAt: string;
  author: AdminRequestUserSummary;
}

export interface AdminRequestItem {
  id: string;
  publicId: string;
  description: string;
  status: 'NEW' | 'CLARIFICATION_REQUIRED' | 'DONE' | 'REJECTED';
  completionComment?: string | null;
  rejectionComment?: string | null;
  completedAt?: string | null;
  rejectedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: AdminRequestUserSummary;
  completedBy?: AdminRequestUserSummary | null;
  rejectedBy?: AdminRequestUserSummary | null;
  links: AdminRequestLinkItem[];
  messages: AdminRequestMessageItem[];
}

export const adminRequestsApi = {
  getAll: async (params: { status?: 'NEW' | 'CLARIFICATION_REQUIRED' | 'DONE' | 'REJECTED'; page?: number; limit?: number } = {}) => {
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

  requestClarification: async (id: string, dto: { clarificationComment: string }) => {
    const { data } = await apiClient.patch(`/admin-requests/${id}/request-clarification`, dto);
    return data as AdminRequestItem;
  },

  reply: async (id: string, dto: { text: string }) => {
    const { data } = await apiClient.patch(`/admin-requests/${id}/reply`, dto);
    return data as AdminRequestItem;
  },

  reject: async (id: string, dto: { rejectionComment?: string }) => {
    const { data } = await apiClient.patch(`/admin-requests/${id}/reject`, dto);
    return data as AdminRequestItem;
  },
};
