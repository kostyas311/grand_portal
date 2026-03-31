import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  CardStatus,
  CardPriority,
  HistoryAction,
  NotificationType,
  UserRole,
  WatchSource,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { AssignDto } from './dto/assign.dto';
import { CardsFilterDto } from './dto/cards-filter.dto';
import { NotificationsService } from '../notifications/notifications.service';

const CARD_INCLUDE = {
  dataSource: { select: { id: true, name: true } },
  executor: { select: { id: true, fullName: true, email: true } },
  reviewer: { select: { id: true, fullName: true, email: true } },
  createdBy: { select: { id: true, fullName: true } },
  lastChangedBy: { select: { id: true, fullName: true } },
  parent: { select: { id: true, publicId: true, dataSource: { select: { name: true } }, extraTitle: true } },
  children: {
    select: { id: true, publicId: true, status: true, dataSource: { select: { name: true } }, extraTitle: true },
    orderBy: { createdAt: 'asc' as const },
  },
  _count: {
    select: { sourceMaterials: true, resultVersions: true, comments: true },
  },
};

@Injectable()
export class CardsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async findAll(filter: CardsFilterDto, userId: string, userRole: UserRole) {
    const where: any = {};

    if (filter.status) {
      where.status = Array.isArray(filter.status)
        ? { in: filter.status }
        : filter.status;
    }
    if (filter.dataSourceId) where.dataSourceId = filter.dataSourceId;
    if (filter.month) where.month = filter.month;
    if (filter.year) where.year = filter.year;
    if (filter.priority) where.priority = filter.priority;
    // When explicitly filtering for CANCELLED, include archived cards
    const isCancelledFilter = filter.status === CardStatus.CANCELLED ||
      (Array.isArray(filter.status) && filter.status.includes(CardStatus.CANCELLED) && filter.status.length === 1);
    if (filter.isArchived !== undefined) where.isArchived = filter.isArchived;
    else if (!isCancelledFilter) where.isArchived = false;

    // Due date filters
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (filter.dueFilter === 'overdue') {
      where.dueDate = { lt: today };
      where.status = { notIn: [CardStatus.DONE, CardStatus.CANCELLED] };
    } else if (filter.dueFilter === 'today') {
      where.dueDate = { gte: today, lt: new Date(today.getTime() + 86400000) };
    } else if (filter.dueFilter === 'next7') {
      where.dueDate = { gte: today, lt: new Date(today.getTime() + 7 * 86400000) };
    } else if (filter.dueFilter === 'next30') {
      where.dueDate = { gte: today, lt: new Date(today.getTime() + 30 * 86400000) };
    } else if (filter.dueFilter === 'none') {
      where.dueDate = null;
    } else if (filter.dueDateFrom || filter.dueDateTo) {
      where.dueDate = {};
      if (filter.dueDateFrom) where.dueDate.gte = new Date(filter.dueDateFrom);
      if (filter.dueDateTo) where.dueDate.lte = new Date(filter.dueDateTo);
    }

    // Full-text search
    if (filter.search) {
      where.OR = [
        { extraTitle: { contains: filter.search, mode: 'insensitive' } },
        { description: { contains: filter.search, mode: 'insensitive' } },
        { publicId: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    // My cards only filter — uses AND to not conflict with search OR
    if (filter.myCards) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { executorId: userId },
            { reviewerId: userId },
            { createdById: userId },
          ],
        },
      ];
    }

    if (filter.assignedToMe) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { executorId: userId },
            {
              AND: [
                { reviewerId: userId },
                { status: CardStatus.REVIEW },
              ],
            },
            {
              watchers: {
                some: { userId, source: WatchSource.MANUAL },
              },
            },
          ],
        },
      ];
    }

    if (filter.createdByMe) {
      where.AND = [
        ...(where.AND || []),
        { createdById: userId },
      ];
    }

    const page = filter.page || 1;
    const limit = Math.min(filter.limit || 20, 500);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.card.findMany({
        where,
        include: CARD_INCLUDE,
        orderBy: this.buildOrderBy(filter.sortBy, filter.sortOrder),
        skip,
        take: limit,
      }),
      this.prisma.card.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findDone(filter: { search?: string; dataSourceId?: string; month?: number; year?: number; page?: number; limit?: number; sortOrder?: 'asc' | 'desc' }) {
    const where: any = {
      status: CardStatus.DONE,
      isArchived: false,
    };

    if (filter.dataSourceId) where.dataSourceId = filter.dataSourceId;
    if (filter.month) where.month = filter.month;
    if (filter.year) where.year = filter.year;
    if (filter.search) {
      where.OR = [
        { extraTitle: { contains: filter.search, mode: 'insensitive' } },
        { description: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const page = filter.page || 1;
    const limit = Math.min(filter.limit || 20, 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.card.findMany({
        where,
        include: {
          ...CARD_INCLUDE,
          resultVersions: {
            where: { isCurrent: true },
            include: { items: true },
          },
        },
        orderBy: [{ year: filter.sortOrder || 'desc' }, { month: filter.sortOrder || 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.card.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const card = await this.prisma.card.findFirst({
      where: { OR: [{ id }, { publicId: id }] },
      include: {
        ...CARD_INCLUDE,
        sourceMaterials: {
          include: {
            uploadedBy: { select: { id: true, fullName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        resultVersions: {
          include: {
            createdBy: { select: { id: true, fullName: true } },
            items: true,
            comments: {
              include: { author: { select: { id: true, fullName: true } } },
            },
          },
          orderBy: { versionNumber: 'desc' },
        },
        history: {
          include: {
            user: { select: { id: true, fullName: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        comments: {
          include: {
            author: { select: { id: true, fullName: true } },
            resultVersion: { select: { id: true, versionNumber: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!card) throw new NotFoundException('Карточка не найдена');
    return card;
  }

  async create(dto: CreateCardDto, userId: string) {
    const publicId = await this.generatePublicId();

    // Resolve parent UUID if provided
    let parentId: string | undefined;
    if (dto.parentId) {
      const parent = await this.findById(dto.parentId);
      parentId = parent.id;
    }

    const card = await this.prisma.card.create({
      data: {
        publicId,
        dataSourceId: dto.dataSourceId,
        extraTitle: dto.extraTitle,
        month: dto.month,
        year: dto.year,
        description: dto.description,
        priority: dto.priority || CardPriority.NORMAL,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        executorId: dto.executorId,
        reviewerId: dto.reviewerId,
        createdById: userId,
        status: CardStatus.NEW,
        parentId,
        withoutResult: dto.withoutResult ?? false,
        withoutSourceMaterials: dto.withoutSourceMaterials ?? false,
      },
      include: CARD_INCLUDE,
    });

    await this.prisma.cardWatcher.create({
      data: {
        cardId: card.id,
        userId,
        source: WatchSource.AUTO,
      },
    });

    await this.logHistory(card.id, userId, HistoryAction.CREATED, null, {
      status: CardStatus.NEW,
      publicId,
    });

    await this.notifications.createForCardEvent(card.id, {
      type: NotificationType.ASSIGNMENT_CHANGED,
      title: 'Новая карточка назначена',
      message: `Карточка «${this.getCardDisplayName(card)}» назначена вам в работу.`,
      actorId: userId,
      includeWatchers: false,
      extraUserIds: [card.executorId],
      excludeUserIds: [userId],
    });

    await this.notifications.createForCardEvent(card.id, {
      type: NotificationType.ASSIGNMENT_CHANGED,
      title: 'Вы назначены проверяющим',
      message: `Карточка «${this.getCardDisplayName(card)}» ожидает вашего участия как проверяющего.`,
      actorId: userId,
      includeWatchers: false,
      extraUserIds: [card.reviewerId],
      excludeUserIds: [userId],
    });

    return card;
  }

  async update(id: string, dto: UpdateCardDto, userId: string, userRole?: UserRole) {
    const card = await this.findById(id);
    this.assertNotLocked(card);
    this.assertCanEditWorkingCard(card, userId, userRole);

    const updated = await this.prisma.card.update({
      where: { id: card.id },
      data: {
        dataSourceId: dto.dataSourceId,
        extraTitle: dto.extraTitle,
        month: dto.month,
        year: dto.year,
        description: dto.description,
        priority: dto.priority,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        withoutResult: dto.withoutResult,
        withoutSourceMaterials: dto.withoutSourceMaterials,
        lastChangedById: userId,
      },
      include: CARD_INCLUDE,
    });

    await this.logHistory(card.id, userId, HistoryAction.FIELD_UPDATED, null, {
      fields: Object.keys(dto),
    });

    return updated;
  }

  async changeStatus(id: string, dto: ChangeStatusDto, userId: string, userRole?: UserRole) {
    const card = await this.findById(id);
    const isForce = dto.force === true && userRole === UserRole.ADMIN;

    if (!isForce) {
      this.assertNotLocked(card);
    }

    const oldStatus = card.status;
    const newStatus = dto.status;

    // Validate transition (skip for admin force)
    if (!isForce) {
      this.assertCanChangeStatus(card, userId, userRole, newStatus);
      await this.validateStatusTransition(oldStatus, newStatus, card, dto);
    }

    const updateData: any = {
      status: newStatus,
      lastChangedById: userId,
    };

    if (newStatus === CardStatus.DONE) {
      updateData.isLocked = true;
      updateData.completedAt = new Date();
    } else if (isForce && oldStatus === CardStatus.DONE) {
      // Force re-open from DONE — unlock and clear completedAt
      updateData.isLocked = false;
      updateData.completedAt = null;
    }

    if (newStatus === CardStatus.CANCELLED) {
      updateData.isLocked = true;
      updateData.isArchived = true;
      updateData.cancelReason = dto.reason;
    } else if (isForce && oldStatus === CardStatus.CANCELLED) {
      // Force re-open from CANCELLED — unlock and un-archive
      updateData.isLocked = false;
      updateData.isArchived = false;
      updateData.cancelReason = null;
    }

    const updated = await this.prisma.card.update({
      where: { id: card.id },
      data: updateData,
      include: CARD_INCLUDE,
    });

    const action =
      newStatus === CardStatus.DONE
        ? HistoryAction.COMPLETED
        : newStatus === CardStatus.CANCELLED
        ? HistoryAction.CANCELLED
        : oldStatus === CardStatus.REVIEW && newStatus === CardStatus.IN_PROGRESS
        ? HistoryAction.RETURNED_WITH_ERRORS
        : HistoryAction.STATUS_CHANGED;

    await this.logHistory(card.id, userId, action, { status: oldStatus }, { status: newStatus, comment: dto.reason || dto.comment });

    await this.notifications.createForCardEvent(card.id, {
      type: newStatus === CardStatus.REVIEW ? NotificationType.REVIEW_REQUEST : NotificationType.STATUS_CHANGED,
      title: this.getStatusNotificationTitle(newStatus),
      message: this.getStatusNotificationMessage(card, newStatus, dto.comment || dto.reason),
      actorId: userId,
      extraUserIds: newStatus === CardStatus.REVIEW ? [card.reviewerId] : [],
      excludeUserIds: [userId],
    });

    // If returned with errors — add review comment
    if (action === HistoryAction.RETURNED_WITH_ERRORS && dto.comment) {
      const currentVersion = await this.prisma.resultVersion.findFirst({
        where: { cardId: card.id, isCurrent: true },
      });
      await this.prisma.reviewComment.create({
        data: {
          cardId: card.id,
          authorId: userId,
          resultVersionId: currentVersion?.id,
          text: dto.comment,
        },
      });
    }

    return updated;
  }

  async assign(id: string, dto: AssignDto, userId: string) {
    const card = await this.findById(id);
    this.assertNotLocked(card);

    const updateData: any = { lastChangedById: userId };
    if (dto.executorId !== undefined) {
      updateData.executorId = dto.executorId;
      await this.logHistory(card.id, userId, HistoryAction.EXECUTOR_CHANGED,
        { executorId: card.executorId },
        { executorId: dto.executorId });
    }
    if (dto.reviewerId !== undefined) {
      updateData.reviewerId = dto.reviewerId;
      await this.logHistory(card.id, userId, HistoryAction.REVIEWER_CHANGED,
        { reviewerId: card.reviewerId },
        { reviewerId: dto.reviewerId });
    }

    const updated = await this.prisma.card.update({
      where: { id: card.id },
      data: updateData,
      include: CARD_INCLUDE,
    });

    if (dto.executorId !== undefined) {
      await this.notifications.createForCardEvent(card.id, {
        type: NotificationType.ASSIGNMENT_CHANGED,
        title: 'Исполнитель обновлён',
        message: `Для карточки «${this.getCardDisplayName(updated)}» обновлён исполнитель.`,
        actorId: userId,
        includeWatchers: true,
        extraUserIds: [dto.executorId],
        excludeUserIds: [userId],
      });
    }

    if (dto.reviewerId !== undefined) {
      await this.notifications.createForCardEvent(card.id, {
        type: NotificationType.ASSIGNMENT_CHANGED,
        title: 'Проверяющий обновлён',
        message: `Для карточки «${this.getCardDisplayName(updated)}» обновлён проверяющий.`,
        actorId: userId,
        includeWatchers: true,
        extraUserIds: [dto.reviewerId],
        excludeUserIds: [userId],
      });
    }

    return updated;
  }

  async hardDelete(id: string) {
    const card = await this.findById(id);
    await this.prisma.card.delete({ where: { id: card.id } });
    return { message: 'Карточка удалена' };
  }

  async toggleWatch(cardId: string, userId: string) {
    const card = await this.findById(cardId);
    const existing = await this.prisma.cardWatcher.findUnique({
      where: { cardId_userId: { cardId: card.id, userId } },
    });
    if (existing) {
      await this.prisma.cardWatcher.delete({ where: { id: existing.id } });
      return { watching: false };
    } else {
      await this.prisma.cardWatcher.create({
        data: {
          cardId: card.id,
          userId,
          source: WatchSource.MANUAL,
        },
      });
      return { watching: true };
    }
  }

  async getWatchStatus(cardId: string, userId: string) {
    const card = await this.findById(cardId);
    const watcher = await this.prisma.cardWatcher.findUnique({
      where: { cardId_userId: { cardId: card.id, userId } },
    });
    const count = await this.prisma.cardWatcher.count({ where: { cardId: card.id } });
    return { watching: !!watcher, watcherCount: count };
  }

  async getStats(filter: { month?: number; year?: number; dueDateFrom?: string; dueDateTo?: string }) {
    const where: any = {};
    if (filter.month) where.month = filter.month;
    if (filter.year) where.year = filter.year;
    if (filter.dueDateFrom || filter.dueDateTo) {
      where.dueDate = {};
      if (filter.dueDateFrom) where.dueDate.gte = new Date(filter.dueDateFrom);
      if (filter.dueDateTo) where.dueDate.lte = new Date(filter.dueDateTo);
    }

    const groups = await this.prisma.card.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });

    const result: Record<string, number> = {
      NEW: 0,
      IN_PROGRESS: 0,
      REVIEW: 0,
      DONE: 0,
      CANCELLED: 0,
    };
    for (const g of groups) {
      result[g.status] = g._count._all;
    }
    result.total = Object.values(result).reduce((a, b) => a + b, 0);
    return result;
  }

  // === Private helpers ===

  private assertNotLocked(card: any) {
    if (card.isLocked) {
      throw new ForbiddenException('Карточка закрыта и не может быть изменена');
    }
  }

  private assertCanEditWorkingCard(card: any, userId: string, userRole?: UserRole) {
    if (userRole === UserRole.ADMIN) {
      return;
    }

    if (card.status !== CardStatus.IN_PROGRESS || card.executorId !== userId) {
      throw new ForbiddenException(
        'Изменения в карточке доступны только исполнителю, пока карточка находится в статусе "В работе"',
      );
    }
  }

  private assertCanChangeStatus(
    card: any,
    userId: string,
    userRole: UserRole | undefined,
    nextStatus: CardStatus,
  ) {
    if (userRole === UserRole.ADMIN) {
      return;
    }

    if (nextStatus === CardStatus.CANCELLED) {
      return;
    }

    const currentStatus = card.status as CardStatus;
    const isExecutor = card.executorId === userId;
    const isReviewer = card.reviewerId === userId;

    const allowed =
      (currentStatus === CardStatus.NEW && nextStatus === CardStatus.IN_PROGRESS && isExecutor) ||
      (currentStatus === CardStatus.IN_PROGRESS && nextStatus === CardStatus.REVIEW && isExecutor) ||
      (currentStatus === CardStatus.REVIEW &&
        (nextStatus === CardStatus.DONE ||
          nextStatus === CardStatus.IN_PROGRESS) &&
        isReviewer);

    if (!allowed) {
      throw new ForbiddenException(
        'Недостаточно прав для смены статуса на текущем этапе карточки',
      );
    }
  }

  private async validateStatusTransition(
    from: CardStatus,
    to: CardStatus,
    card: any,
    dto: ChangeStatusDto,
  ) {
    const allowed: Record<CardStatus, CardStatus[]> = {
      [CardStatus.NEW]: [CardStatus.IN_PROGRESS, CardStatus.CANCELLED],
      [CardStatus.IN_PROGRESS]: [CardStatus.REVIEW, CardStatus.CANCELLED],
      [CardStatus.REVIEW]: [CardStatus.DONE, CardStatus.IN_PROGRESS, CardStatus.CANCELLED],
      [CardStatus.DONE]: [],
      [CardStatus.CANCELLED]: [],
    };

    if (!allowed[from].includes(to)) {
      throw new BadRequestException(
        `Недопустимый переход статуса из "${from}" в "${to}"`,
      );
    }

    if (to === CardStatus.REVIEW) {
      if (!card.reviewerId) {
        throw new BadRequestException(
          'Невозможно отправить на проверку без назначенного проверяющего',
        );
      }
      if (!card.withoutResult && (!card._count || card._count.resultVersions === 0)) {
        throw new BadRequestException(
          'Невозможно отправить на проверку без результата. Сначала загрузите результат.',
        );
      }
      // All child cards must be DONE before parent can go to REVIEW
      if (card.children && card.children.length > 0) {
        const notDone = card.children.filter((c: any) => c.status !== CardStatus.DONE);
        if (notDone.length > 0) {
          throw new BadRequestException(
            `Нельзя отправить на проверку: ${notDone.length} дочерних карточек не завершены. Сначала завершите все дочерние карточки.`,
          );
        }
      }
      // If returned from review, require a NEW version uploaded after the return
      if (from === CardStatus.IN_PROGRESS) {
        const returnEvent = await this.prisma.cardHistory.findFirst({
          where: { cardId: card.id, actionType: HistoryAction.RETURNED_WITH_ERRORS },
          orderBy: { createdAt: 'desc' },
        });
        if (returnEvent) {
          const newVersion = await this.prisma.resultVersion.findFirst({
            where: { cardId: card.id, createdAt: { gt: returnEvent.createdAt } },
          });
          if (!newVersion) {
            throw new BadRequestException(
              'Карточка была возвращена с замечаниями. Загрузите новую версию результата перед повторной отправкой на проверку.',
            );
          }
        }
      }
    }

    if (to === CardStatus.IN_PROGRESS && from === CardStatus.REVIEW) {
      if (!dto.comment) {
        throw new BadRequestException(
          'При возврате с проверки необходимо указать причину/комментарий',
        );
      }
    }

    if (to === CardStatus.CANCELLED && !dto.reason) {
      throw new BadRequestException('Необходимо указать причину отмены');
    }
  }

  private async generatePublicId(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `NB-${year}-`;
    const last = await this.prisma.card.findFirst({
      where: { publicId: { startsWith: prefix } },
      orderBy: { publicId: 'desc' },
      select: { publicId: true },
    });
    let seq = 1;
    if (last) {
      const lastNum = parseInt(last.publicId.slice(prefix.length), 10);
      if (!isNaN(lastNum)) seq = lastNum + 1;
    }
    return `${prefix}${seq.toString().padStart(4, '0')}`;
  }

  private async logHistory(
    cardId: string,
    userId: string,
    actionType: HistoryAction,
    oldValue: any,
    newValue: any,
    comment?: string,
  ) {
    await this.prisma.cardHistory.create({
      data: { cardId, userId, actionType, oldValue, newValue, comment },
    });
  }

  private buildOrderBy(sortBy?: string, sortOrder: 'asc' | 'desc' = 'desc') {
    const order = sortOrder;
    switch (sortBy) {
      case 'publicId': return [{ publicId: order }];
      case 'dataSource': return [{ dataSource: { name: order } }, { extraTitle: order }];
      case 'priority': return [{ priority: order }];
      case 'dueDate': return [{ dueDate: order }];
      case 'status': return [{ status: order }];
      case 'executor': return [{ executor: { fullName: order } }];
      case 'reviewer': return [{ reviewer: { fullName: order } }];
      case 'createdAt': return [{ createdAt: order }];
      case 'updatedAt': return [{ updatedAt: order }];
      case 'year': return [{ year: order }, { month: order }];
      default: return [{ updatedAt: 'desc' as const }];
    }
  }

  private getCardDisplayName(card: any) {
    return card.extraTitle || card.dataSource?.name || card.publicId;
  }

  private getStatusNotificationTitle(status: CardStatus) {
    switch (status) {
      case CardStatus.IN_PROGRESS:
        return 'Карточка взята в работу';
      case CardStatus.REVIEW:
        return 'Карточка отправлена на проверку';
      case CardStatus.DONE:
        return 'Карточка подтверждена';
      case CardStatus.CANCELLED:
        return 'Карточка отменена';
      default:
        return 'Статус карточки изменён';
    }
  }

  private getStatusNotificationMessage(card: any, status: CardStatus, comment?: string) {
    const baseName = this.getCardDisplayName(card);
    const commentSuffix = comment ? ` Комментарий: ${comment}` : '';

    switch (status) {
      case CardStatus.IN_PROGRESS:
        return `Карточка «${baseName}» переведена в статус «В работе».${commentSuffix}`;
      case CardStatus.REVIEW:
        return `Карточка «${baseName}» переведена в статус «На проверке».${commentSuffix}`;
      case CardStatus.DONE:
        return `Карточка «${baseName}» подтверждена и завершена.${commentSuffix}`;
      case CardStatus.CANCELLED:
        return `Карточка «${baseName}» была отменена.${commentSuffix}`;
      default:
        return `Статус карточки «${baseName}» изменён.${commentSuffix}`;
    }
  }
}
