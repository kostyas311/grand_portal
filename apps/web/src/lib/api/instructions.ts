import { apiClient } from './client';

export type InstructionStatus = 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'ARCHIVED';

export interface InstructionFolderItem {
  id: string;
  name: string;
  parentId?: string | null;
  parent?: {
    id: string;
    name: string;
  } | null;
  _count?: {
    instructions: number;
    children: number;
  };
}

export interface InstructionItem {
  id: string;
  publicId: string;
  title: string;
  summary?: string | null;
  contentHtml: string;
  status: InstructionStatus;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  createdById: string;
  updatedById?: string | null;
  folder?: {
    id: string;
    name: string;
  } | null;
  createdBy: {
    id: string;
    fullName: string;
    email?: string;
  };
  updatedBy?: {
    id: string;
    fullName: string;
  } | null;
  attachments: Array<{
    id: string;
    fileName: string;
    fileSize: string | number;
    mimeType?: string | null;
    createdAt: string;
    uploadedBy?: {
      id: string;
      fullName: string;
    };
  }>;
  cardLinks: Array<{
    id: string;
    createdAt: string;
    card: {
      id: string;
      publicId: string;
      updatedAt: string;
      extraTitle?: string | null;
      status: string;
      dataSource?: {
        name: string;
      } | null;
    };
  }>;
  _count?: {
    attachments: number;
    cardLinks: number;
  };
}

export interface InstructionAttachmentItem {
  id: string;
  fileName: string;
  fileSize: string | number;
  mimeType?: string | null;
  createdAt: string;
  uploadedBy?: {
    id: string;
    fullName: string;
  };
}

export const instructionsApi = {
  getFolders: async () => {
    const { data } = await apiClient.get('/instruction-folders');
    return data as InstructionFolderItem[];
  },

  getAll: async (params?: {
    search?: string;
    folderId?: string;
    status?: InstructionStatus;
    mineOnly?: boolean;
  }) => {
    const cleanParams = {
      search: params?.search,
      folderId: params?.folderId,
      status: params?.status,
      mineOnly: params?.mineOnly ? true : undefined,
    };

    const { data } = await apiClient.get('/instructions', { params: cleanParams });
    return data as InstructionItem[];
  },

  getPublished: async () => {
    const { data } = await apiClient.get('/instructions/published');
    return data as InstructionItem[];
  },

  getById: async (id: string) => {
    const { data } = await apiClient.get(`/instructions/${id}`);
    return data as InstructionItem;
  },

  create: async (dto: {
    title: string;
    summary?: string;
    contentHtml: string;
    status: InstructionStatus;
    folderId?: string;
    newFolderName?: string;
  }) => {
    const { data } = await apiClient.post('/instructions', dto);
    return data as InstructionItem;
  },

  update: async (
    id: string,
    dto: Partial<{
      title: string;
      summary?: string;
      contentHtml: string;
      status: InstructionStatus;
      folderId?: string;
      newFolderName?: string;
    }>,
  ) => {
    const { data } = await apiClient.patch(`/instructions/${id}`, dto);
    return data as InstructionItem;
  },

  delete: async (id: string) => {
    const { data } = await apiClient.delete(`/instructions/${id}`);
    return data;
  },

  uploadAttachments: async (id: string, formData: FormData) => {
    const { data } = await apiClient.post(`/instructions/${id}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data as InstructionAttachmentItem[];
  },

  deleteAttachment: async (id: string, attachmentId: string) => {
    const { data } = await apiClient.delete(`/instructions/${id}/attachments/${attachmentId}`);
    return data;
  },

  downloadAttachment: async (id: string, attachmentId: string) => {
    const response = await apiClient.get(`/instructions/${id}/attachments/${attachmentId}/download`, {
      responseType: 'blob',
    });
    return {
      blob: response.data as Blob,
      contentDisposition: response.headers['content-disposition'] as string | undefined,
      contentType: response.headers['content-type'] as string | undefined,
    };
  },

  downloadAttachmentUrl: (id: string, attachmentId: string) =>
    `${process.env.NEXT_PUBLIC_API_URL || '/api'}/instructions/${id}/attachments/${attachmentId}/download`,

  getCardInstructions: async (cardId: string) => {
    const { data } = await apiClient.get(`/cards/${cardId}/instructions`);
    return data as Array<{
      id: string;
      createdAt: string;
      instruction: InstructionItem;
    }>;
  },

  attachToCard: async (cardId: string, instructionId: string) => {
    const { data } = await apiClient.post(`/cards/${cardId}/instructions/${instructionId}`);
    return data;
  },

  detachFromCard: async (cardId: string, instructionId: string) => {
    const { data } = await apiClient.delete(`/cards/${cardId}/instructions/${instructionId}`);
    return data;
  },
};
