import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateComponentDto } from './dto/create-component.dto';
import { UpdateComponentDto } from './dto/update-component.dto';

const COMPONENT_INCLUDE = {
  createdBy: { select: { id: true, fullName: true, email: true } },
  updatedBy: { select: { id: true, fullName: true } },
  _count: {
    select: {
      cardLinks: true,
      dataSourceLinks: true,
    },
  },
};

@Injectable()
export class ComponentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private readonly componentCardNotificationInclude = {
    cardLinks: {
      select: {
        card: {
          select: {
            id: true,
            publicId: true,
            extraTitle: true,
            dataSource: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    },
  };

  async findAll(search?: string, includeArchived = false) {
    return this.prisma.component.findMany({
      where: {
        isArchived: includeArchived ? undefined : false,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { description: { contains: search, mode: 'insensitive' as const } },
                { location: { contains: search, mode: 'insensitive' as const } },
                { publicId: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      include: COMPONENT_INCLUDE,
      orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
    });
  }

  async findAvailable(search?: string) {
    return this.prisma.component.findMany({
      where: {
        isArchived: false,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { description: { contains: search, mode: 'insensitive' as const } },
                { location: { contains: search, mode: 'insensitive' as const } },
                { publicId: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      include: COMPONENT_INCLUDE,
      orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
    });
  }

  async findById(id: string) {
    const component = await this.prisma.component.findFirst({
      where: { OR: [{ id }, { publicId: id }] },
      include: COMPONENT_INCLUDE,
    });

    if (!component) {
      throw new NotFoundException('Компонент не найден');
    }

    return component;
  }

  async create(dto: CreateComponentDto, userId: string) {
    const name = dto.name.trim();
    const location = dto.location.trim();

    if (!name) {
      throw new BadRequestException('Укажите название компонента');
    }

    if (!location) {
      throw new BadRequestException('Укажите расположение компонента');
    }

    const existing = await this.prisma.component.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        isArchived: false,
      },
    });

    if (existing) {
      throw new ConflictException('Компонент с таким названием уже существует');
    }

    return this.prisma.component.create({
      data: {
        publicId: await this.generatePublicId(),
        name,
        description: dto.description?.trim() || null,
        location,
        createdById: userId,
        updatedById: userId,
      },
      include: COMPONENT_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateComponentDto, userId: string, userRole?: UserRole) {
    const component = await this.findById(id);
    this.assertCanEditComponent(component, userId, userRole);

    const nextName = dto.name !== undefined ? dto.name.trim() : component.name;
    const nextLocation = dto.location !== undefined ? dto.location.trim() : component.location;

    if (!nextName) {
      throw new BadRequestException('Укажите название компонента');
    }

    if (!nextLocation) {
      throw new BadRequestException('Укажите расположение компонента');
    }

    if (dto.name) {
      const existing = await this.prisma.component.findFirst({
        where: {
          id: { not: component.id },
          name: { equals: nextName, mode: 'insensitive' },
          isArchived: false,
        },
      });

      if (existing) {
        throw new ConflictException('Компонент с таким названием уже существует');
      }
    }

    const updated = await this.prisma.component.update({
      where: { id: component.id },
      data: {
        name: nextName,
        description: dto.description !== undefined ? dto.description?.trim() || null : component.description,
        location: nextLocation,
        updatedById: userId,
      },
      include: {
        ...COMPONENT_INCLUDE,
        ...this.componentCardNotificationInclude,
      },
    });

    await this.notifyLinkedCardsAboutComponentChange(
      updated.cardLinks.map((link) => link.card),
      {
        type: NotificationType.CARD_UPDATED,
        title: 'Компонент обновлён',
        messageBuilder: (card) =>
          `В карточке «${this.getCardDisplayName(card)}» обновлён компонент «${updated.name}».`,
        actorId: userId,
        excludeUserIds: [userId],
      },
    );

    return updated;
  }

  async toggleArchive(id: string, userId: string, userRole?: UserRole) {
    const component = await this.findById(id);
    this.assertCanEditComponent(component, userId, userRole);

    const updated = await this.prisma.component.update({
      where: { id: component.id },
      data: {
        isArchived: !component.isArchived,
        updatedById: userId,
      },
      include: {
        ...COMPONENT_INCLUDE,
        ...this.componentCardNotificationInclude,
      },
    });

    await this.notifyLinkedCardsAboutComponentChange(
      updated.cardLinks.map((link) => link.card),
      {
        type: NotificationType.CARD_UPDATED,
        title: updated.isArchived ? 'Компонент архивирован' : 'Компонент восстановлен',
        messageBuilder: (card) =>
          updated.isArchived
            ? `В карточке «${this.getCardDisplayName(card)}» компонент «${updated.name}» переведён в архив.`
            : `В карточке «${this.getCardDisplayName(card)}» компонент «${updated.name}» снова активен.`,
        actorId: userId,
        excludeUserIds: [userId],
      },
    );

    return updated;
  }

  async delete(id: string, userId?: string) {
    const component = await this.prisma.component.findFirst({
      where: { OR: [{ id }, { publicId: id }] },
      include: this.componentCardNotificationInclude,
    });

    if (!component) {
      throw new NotFoundException('Компонент не найден');
    }

    const linkedCards = component.cardLinks.map((link) => link.card);
    await this.prisma.component.delete({ where: { id: component.id } });

    await this.notifyLinkedCardsAboutComponentChange(linkedCards, {
      type: NotificationType.CARD_UPDATED,
      title: 'Компонент удалён из системы',
      messageBuilder: (card) =>
        `Компонент «${component.name}», связанный с карточкой «${this.getCardDisplayName(card)}», удалён из системы.`,
      actorId: userId,
      excludeUserIds: userId ? [userId] : [],
    });

    return { message: 'Компонент удалён' };
  }

  async getCardComponents(cardId: string) {
    const card = await this.getCard(cardId);

    return this.prisma.cardComponent.findMany({
      where: { cardId: card.id },
      include: {
        component: { include: COMPONENT_INCLUDE },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async attachToCard(cardId: string, componentId: string, userId: string, userRole?: UserRole) {
    const card = await this.getCard(cardId);
    this.assertCanManageCardComponents(card, userId, userRole);

    const component = await this.findById(componentId);
    if (component.isArchived) {
      throw new BadRequestException('В карточку можно вложить только активный компонент');
    }

    const link = await this.prisma.cardComponent.upsert({
      where: {
        cardId_componentId: {
          cardId: card.id,
          componentId: component.id,
        },
      },
      update: {},
      create: {
        cardId: card.id,
        componentId: component.id,
        createdById: userId,
      },
      include: {
        component: { include: COMPONENT_INCLUDE },
      },
    });

    await this.notifications.createForCardEvent(card.id, {
      type: NotificationType.CARD_UPDATED,
      title: 'Компонент привязан к карточке',
      message: `В карточку «${this.getCardDisplayName(card)}» добавлен компонент «${component.name}».`,
      actorId: userId,
      excludeUserIds: [userId],
    });

    return link;
  }

  async detachFromCard(cardId: string, componentId: string, userId: string, userRole?: UserRole) {
    const card = await this.getCard(cardId);
    this.assertCanManageCardComponents(card, userId, userRole);

    const link = await this.prisma.cardComponent.findFirst({
      where: {
        cardId: card.id,
        component: {
          OR: [{ id: componentId }, { publicId: componentId }],
        },
      },
      include: {
        component: { select: { name: true } },
      },
    });

    if (!link) {
      throw new NotFoundException('Привязанный компонент не найден');
    }

    await this.prisma.cardComponent.delete({ where: { id: link.id } });

    await this.notifications.createForCardEvent(card.id, {
      type: NotificationType.CARD_UPDATED,
      title: 'Компонент отвязан от карточки',
      message: `Из карточки «${this.getCardDisplayName(card)}» убран компонент «${link.component.name}».`,
      actorId: userId,
      excludeUserIds: [userId],
    });

    return { message: 'Компонент отвязан от карточки' };
  }

  async getDataSourceComponents(id: string) {
    const source = await this.getDataSource(id);

    return this.prisma.dataSourceComponent.findMany({
      where: { dataSourceId: source.id },
      include: {
        component: { include: COMPONENT_INCLUDE },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async attachToDataSource(id: string, componentId: string, userId: string, userRole?: UserRole) {
    this.assertCanManageDataSourceComponents(userRole);
    const source = await this.getDataSource(id);
    const component = await this.findById(componentId);

    if (component.isArchived) {
      throw new BadRequestException('К источнику можно привязать только активный компонент');
    }

    return this.prisma.dataSourceComponent.upsert({
      where: {
        dataSourceId_componentId: {
          dataSourceId: source.id,
          componentId: component.id,
        },
      },
      update: {},
      create: {
        dataSourceId: source.id,
        componentId: component.id,
        createdById: userId,
      },
      include: {
        component: { include: COMPONENT_INCLUDE },
      },
    });
  }

  async detachFromDataSource(id: string, componentId: string, userRole?: UserRole) {
    this.assertCanManageDataSourceComponents(userRole);
    const source = await this.getDataSource(id);

    const link = await this.prisma.dataSourceComponent.findFirst({
      where: {
        dataSourceId: source.id,
        component: {
          OR: [{ id: componentId }, { publicId: componentId }],
        },
      },
    });

    if (!link) {
      throw new NotFoundException('Компонент не привязан к источнику');
    }

    await this.prisma.dataSourceComponent.delete({ where: { id: link.id } });
    return { message: 'Компонент отвязан от источника' };
  }

  private async getCard(cardId: string) {
    const card = await this.prisma.card.findFirst({
      where: { OR: [{ id: cardId }, { publicId: cardId }] },
    });

    if (!card) {
      throw new NotFoundException('Карточка не найдена');
    }

    return card;
  }

  private async getDataSource(id: string) {
    const source = await this.prisma.dataSource.findUnique({
      where: { id },
    });

    if (!source) {
      throw new NotFoundException('Источник данных не найден');
    }

    return source;
  }

  private getCardDisplayName(card: {
    publicId: string;
    extraTitle?: string | null;
    dataSource?: { name?: string | null } | null;
  }) {
    if (card.dataSource?.name && card.extraTitle) {
      return `${card.dataSource.name} — ${card.extraTitle}`;
    }

    return card.dataSource?.name || card.extraTitle || card.publicId;
  }

  private assertCanEditComponent(component: any, userId: string, userRole?: UserRole) {
    if (userRole === UserRole.ADMIN) {
      return;
    }

    if (component.createdById !== userId) {
      throw new ForbiddenException('Редактировать компонент может только автор или администратор');
    }
  }

  private assertCanManageCardComponents(card: any, userId: string, userRole?: UserRole) {
    if (card.isLocked) {
      throw new ForbiddenException('Карточка закрыта');
    }

    if (userRole === UserRole.ADMIN) {
      return;
    }

    const canManage =
      card.createdById === userId ||
      card.executorId === userId ||
      card.reviewerId === userId;

    if (!canManage) {
      throw new ForbiddenException('Недостаточно прав для изменения компонентов карточки');
    }
  }

  private assertCanManageDataSourceComponents(userRole?: UserRole) {
    if (userRole === UserRole.ADMIN || userRole === UserRole.MANAGER) {
      return;
    }

    throw new ForbiddenException('Недостаточно прав для управления компонентами источника');
  }

  private async generatePublicId() {
    const year = new Date().getFullYear();
    const prefix = `CMP-${year}-`;

    const last = await this.prisma.component.findFirst({
      where: { publicId: { startsWith: prefix } },
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

  private async notifyLinkedCardsAboutComponentChange(
    cards: Array<{
      id: string;
      publicId: string;
      extraTitle?: string | null;
      dataSource?: { name?: string | null } | null;
    }>,
    params: {
      type: NotificationType;
      title: string;
      messageBuilder: (card: {
        id: string;
        publicId: string;
        extraTitle?: string | null;
        dataSource?: { name?: string | null } | null;
      }) => string;
      actorId?: string;
      excludeUserIds?: string[];
    },
  ) {
    const uniqueCards = Array.from(new Map(cards.map((card) => [card.id, card])).values());

    await Promise.all(
      uniqueCards.map((card) =>
        this.notifications.createForCardEvent(card.id, {
          type: params.type,
          title: params.title,
          message: params.messageBuilder(card),
          actorId: params.actorId,
          excludeUserIds: params.excludeUserIds,
        }),
      ),
    );
  }
}
