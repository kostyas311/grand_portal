import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdminRequestStatus, NotificationType, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateAdminRequestDto } from './dto/create-admin-request.dto';
import { CompleteAdminRequestDto } from './dto/complete-admin-request.dto';
import { AdminRequestsFilterDto } from './dto/admin-requests-filter.dto';
import { RequestClarificationAdminRequestDto } from './dto/request-clarification-admin-request.dto';
import { RejectAdminRequestDto } from './dto/reject-admin-request.dto';
import { ReplyAdminRequestDto } from './dto/reply-admin-request.dto';

const ADMIN_REQUEST_INCLUDE = {
  createdBy: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  completedBy: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  rejectedBy: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  links: {
    orderBy: { createdAt: 'asc' as const },
  },
  messages: {
    include: {
      author: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
};

@Injectable()
export class AdminRequestsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async findAll(filter: AdminRequestsFilterDto, userId: string, userRole: UserRole) {
    const page = filter.page || 1;
    const limit = Math.min(filter.limit || 50, 100);

    const where: any = {};

    if (filter.status) {
      where.status = filter.status;
    }

    if (userRole !== UserRole.ADMIN) {
      where.createdById = userId;
    }

    const [items, total] = await Promise.all([
      this.prisma.adminRequest.findMany({
        where,
        include: ADMIN_REQUEST_INCLUDE,
        orderBy: [{ updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.adminRequest.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async create(dto: CreateAdminRequestDto, userId: string, userRole: UserRole) {
    if (userRole === UserRole.ADMIN) {
      throw new ForbiddenException('Администратор не может отправлять обращения самому себе');
    }

    const publicId = await this.generatePublicId();
    const normalizedLinks = Array.from(
      new Set((dto.links || []).map((link) => link.trim()).filter(Boolean)),
    );

    const request = await this.prisma.adminRequest.create({
      data: {
        publicId,
        description: dto.description.trim(),
        createdById: userId,
        links: {
          create: normalizedLinks.map((url) => ({ url })),
        },
      },
      include: ADMIN_REQUEST_INCLUDE,
    });

    const admins = await this.prisma.user.findMany({
      where: {
        role: UserRole.ADMIN,
        isActive: true,
      },
      select: { id: true },
    });

    await this.notifications.createForAdminRequestEvent(request.id, {
      type: NotificationType.ADMIN_REQUEST_CREATED,
      title: 'Новое обращение к администратору',
      message: `Поступило новое обращение ${request.publicId}. ${this.getPreview(request.description)}`,
      actorId: userId,
      recipientUserIds: admins.map((admin) => admin.id),
    });

    return request;
  }

  async complete(
    id: string,
    dto: CompleteAdminRequestDto,
    userId: string,
    userRole: UserRole,
  ) {
    if (userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Обрабатывать обращения может только администратор');
    }

    const request = await this.prisma.adminRequest.findFirst({
      where: {
        OR: [{ id }, { publicId: id }],
      },
      include: ADMIN_REQUEST_INCLUDE,
    });

    if (!request) {
      throw new NotFoundException('Обращение не найдено');
    }

    if (request.status === AdminRequestStatus.DONE) {
      throw new BadRequestException('Обращение уже отмечено как выполненное');
    }

    if (request.status === AdminRequestStatus.REJECTED) {
      throw new BadRequestException('Отклонённое обращение нельзя завершить');
    }

    const updated = await this.prisma.adminRequest.update({
      where: { id: request.id },
      data: {
        status: AdminRequestStatus.DONE,
        completedById: userId,
        rejectedById: null,
        completedAt: new Date(),
        rejectedAt: null,
        completionComment: dto.completionComment?.trim() || null,
        rejectionComment: null,
      },
      include: ADMIN_REQUEST_INCLUDE,
    });

    await this.notifications.createForAdminRequestEvent(updated.id, {
      type: NotificationType.ADMIN_REQUEST_COMPLETED,
      title: 'Обращение выполнено',
      message: this.buildCompletionMessage(updated),
      actorId: userId,
      recipientUserIds: [updated.createdById],
      excludeUserIds: [userId],
    });

    return updated;
  }

  async requestClarification(
    id: string,
    dto: RequestClarificationAdminRequestDto,
    userId: string,
    userRole: UserRole,
  ) {
    if (userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Вернуть обращение на уточнение может только администратор');
    }

    const request = await this.prisma.adminRequest.findFirst({
      where: {
        OR: [{ id }, { publicId: id }],
      },
      include: ADMIN_REQUEST_INCLUDE,
    });

    if (!request) {
      throw new NotFoundException('Обращение не найдено');
    }

    if (request.status === AdminRequestStatus.DONE) {
      throw new BadRequestException('Выполненное обращение нельзя вернуть на уточнение');
    }

    if (request.status === AdminRequestStatus.REJECTED) {
      throw new BadRequestException('Отклонённое обращение нельзя вернуть на уточнение');
    }

    const comment = dto.clarificationComment.trim();

    const updated = await this.prisma.adminRequest.update({
      where: { id: request.id },
      data: {
        status: AdminRequestStatus.CLARIFICATION_REQUIRED,
        completedById: null,
        completedAt: null,
        completionComment: null,
        rejectedById: null,
        rejectedAt: null,
        rejectionComment: null,
        messages: {
          create: {
            authorId: userId,
            text: comment,
          },
        },
      },
      include: ADMIN_REQUEST_INCLUDE,
    });

    await this.notifications.createForAdminRequestEvent(updated.id, {
      type: NotificationType.ADMIN_REQUEST_NEEDS_INFO,
      title: 'Обращение возвращено на уточнение',
      message: `По обращению ${updated.publicId} требуется уточнение. Комментарий администратора: ${comment}`,
      actorId: userId,
      recipientUserIds: [updated.createdById],
      excludeUserIds: [userId],
    });

    return updated;
  }

  async reply(
    id: string,
    dto: ReplyAdminRequestDto,
    userId: string,
    userRole: UserRole,
  ) {
    if (userRole === UserRole.ADMIN) {
      throw new ForbiddenException('Администратор не может отправлять уточнение самому себе');
    }

    const request = await this.prisma.adminRequest.findFirst({
      where: {
        OR: [{ id }, { publicId: id }],
      },
      include: ADMIN_REQUEST_INCLUDE,
    });

    if (!request) {
      throw new NotFoundException('Обращение не найдено');
    }

    if (request.createdById !== userId) {
      throw new ForbiddenException('Вы можете уточнять только свои обращения');
    }

    if (request.status !== AdminRequestStatus.CLARIFICATION_REQUIRED) {
      throw new BadRequestException('Обращение сейчас не находится на уточнении');
    }

    const text = dto.text.trim();

    const updated = await this.prisma.adminRequest.update({
      where: { id: request.id },
      data: {
        status: AdminRequestStatus.NEW,
        messages: {
          create: {
            authorId: userId,
            text,
          },
        },
      },
      include: ADMIN_REQUEST_INCLUDE,
    });

    const admins = await this.prisma.user.findMany({
      where: {
        role: UserRole.ADMIN,
        isActive: true,
      },
      select: { id: true },
    });

    await this.notifications.createForAdminRequestEvent(updated.id, {
      type: NotificationType.ADMIN_REQUEST_REPLIED,
      title: 'Пользователь уточнил обращение',
      message: `По обращению ${updated.publicId} поступило уточнение от пользователя: ${this.getPreview(text)}`,
      actorId: userId,
      recipientUserIds: admins.map((admin) => admin.id),
      excludeUserIds: [userId],
    });

    return updated;
  }

  async reject(
    id: string,
    dto: RejectAdminRequestDto,
    userId: string,
    userRole: UserRole,
  ) {
    if (userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Отклонять обращения может только администратор');
    }

    const request = await this.prisma.adminRequest.findFirst({
      where: {
        OR: [{ id }, { publicId: id }],
      },
      include: ADMIN_REQUEST_INCLUDE,
    });

    if (!request) {
      throw new NotFoundException('Обращение не найдено');
    }

    if (request.status === AdminRequestStatus.DONE) {
      throw new BadRequestException('Выполненное обращение нельзя отклонить');
    }

    if (request.status === AdminRequestStatus.REJECTED) {
      throw new BadRequestException('Обращение уже отклонено');
    }

    const comment = dto.rejectionComment?.trim() || null;

    const updated = await this.prisma.adminRequest.update({
      where: { id: request.id },
      data: {
        status: AdminRequestStatus.REJECTED,
        rejectedById: userId,
        rejectedAt: new Date(),
        rejectionComment: comment,
        completedById: null,
        completedAt: null,
        completionComment: null,
      },
      include: ADMIN_REQUEST_INCLUDE,
    });

    await this.notifications.createForAdminRequestEvent(updated.id, {
      type: NotificationType.ADMIN_REQUEST_REJECTED,
      title: 'Обращение отклонено',
      message: this.buildRejectionMessage(updated),
      actorId: userId,
      recipientUserIds: [updated.createdById],
      excludeUserIds: [userId],
    });

    return updated;
  }

  private async generatePublicId() {
    const year = new Date().getFullYear();
    const prefix = `AR-${year}-`;
    const last = await this.prisma.adminRequest.findFirst({
      where: {
        publicId: { startsWith: prefix },
      },
      orderBy: { publicId: 'desc' },
      select: { publicId: true },
    });

    let seq = 1;
    if (last) {
      const lastNum = parseInt(last.publicId.slice(prefix.length), 10);
      if (!Number.isNaN(lastNum)) {
        seq = lastNum + 1;
      }
    }

    return `${prefix}${seq.toString().padStart(4, '0')}`;
  }

  private getPreview(description: string) {
    const compact = description.replace(/\s+/g, ' ').trim();
    return compact.length > 120 ? `${compact.slice(0, 117)}...` : compact;
  }

  private buildCompletionMessage(request: {
    publicId: string;
    completionComment?: string | null;
  }) {
    const suffix = request.completionComment
      ? ` Комментарий администратора: ${request.completionComment}`
      : '';

    return `Ваше обращение ${request.publicId} отмечено как выполненное.${suffix}`;
  }

  private buildRejectionMessage(request: {
    publicId: string;
    rejectionComment?: string | null;
  }) {
    const suffix = request.rejectionComment
      ? ` Комментарий администратора: ${request.rejectionComment}`
      : '';

    return `Ваше обращение ${request.publicId} отклонено.${suffix}`;
  }
}
