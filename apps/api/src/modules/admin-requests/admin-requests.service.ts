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
  links: {
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
    const skip = (page - 1) * limit;

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
        orderBy: [
          { status: 'asc' },
          { createdAt: 'desc' },
        ],
        skip,
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

    const updated = await this.prisma.adminRequest.update({
      where: { id: request.id },
      data: {
        status: AdminRequestStatus.DONE,
        completedById: userId,
        completedAt: new Date(),
        completionComment: dto.completionComment?.trim() || null,
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
}
