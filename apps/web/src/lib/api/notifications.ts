import { apiClient } from './client';

export interface NotificationCardSummary {
  id: string;
  publicId: string;
  extraTitle?: string | null;
  status: string;
  month: number;
  year: number;
  dataSource?: {
    name: string;
  } | null;
}

export interface NotificationAdminRequestSummary {
  id: string;
  publicId: string;
  status: 'NEW' | 'DONE';
  description: string;
  createdBy: {
    id: string;
    fullName: string;
  };
}

export interface NotificationActorSummary {
  id: string;
  fullName: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  card?: NotificationCardSummary | null;
  adminRequest?: NotificationAdminRequestSummary | null;
  actor?: NotificationActorSummary | null;
}

export const notificationsApi = {
  getAll: async (params: { unreadOnly?: boolean; page?: number; limit?: number } = {}) => {
    const { data } = await apiClient.get('/notifications', { params });
    return data as {
      items: NotificationItem[];
      total: number;
      unreadCount: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  },

  getUnreadCount: async () => {
    const { data } = await apiClient.get('/notifications/unread-count');
    return data as { unreadCount: number };
  },

  markAsRead: async (id: string) => {
    const { data } = await apiClient.patch(`/notifications/${id}/read`);
    return data;
  },

  markAllAsRead: async () => {
    const { data } = await apiClient.patch('/notifications/read-all');
    return data as { updated: number };
  },
};
