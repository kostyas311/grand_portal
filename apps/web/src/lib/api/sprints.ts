import { apiClient } from './client';

export type SprintStatus = 'IN_PROGRESS' | 'CLOSED';

export interface SprintItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: SprintStatus;
  createdAt: string;
  updatedAt: string;
  _count?: {
    cards: number;
  };
}

export const sprintsApi = {
  getAll: async () => {
    const { data } = await apiClient.get('/sprints');
    return data as SprintItem[];
  },

  getCurrent: async () => {
    const { data } = await apiClient.get('/sprints/current');
    return data as SprintItem | null;
  },

  create: async (dto: {
    name: string;
    startDate: string;
    endDate: string;
  }) => {
    const { data } = await apiClient.post('/sprints', dto);
    return data as SprintItem;
  },

  update: async (
    id: string,
    dto: Partial<{
      name: string;
      startDate: string;
      endDate: string;
    }>,
  ) => {
    const { data } = await apiClient.patch(`/sprints/${id}`, dto);
    return data as SprintItem;
  },

  close: async (
    id: string,
    dto: {
      nextSprintName?: string;
      nextSprintStartDate?: string;
      nextSprintEndDate?: string;
      transferOpenCards?: boolean;
    },
  ) => {
    const { data } = await apiClient.post(`/sprints/${id}/close`, dto);
    return data as { closedSprint: SprintItem; nextSprint?: SprintItem | null };
  },

  transferOpenCards: async (id: string, targetSprintId: string) => {
    const { data } = await apiClient.post(
      `/sprints/${id}/transfer-open-cards/${targetSprintId}`,
    );
    return data as {
      movedCount: number;
      fromSprint: { id: string; name: string };
      targetSprint: { id: string; name: string };
    };
  },
};
