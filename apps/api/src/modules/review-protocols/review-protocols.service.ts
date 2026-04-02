import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CardStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewProtocolDto } from './dto/create-review-protocol.dto';
import { UpdateReviewProtocolDto } from './dto/update-review-protocol.dto';

const REVIEW_PROTOCOL_INCLUDE = {
  createdBy: { select: { id: true, fullName: true, email: true } },
  updatedBy: { select: { id: true, fullName: true } },
  items: { orderBy: { sortOrder: 'asc' as const } },
};

@Injectable()
export class ReviewProtocolsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(search?: string, includeArchived = false) {
    return this.prisma.reviewProtocol.findMany({
      where: {
        isArchived: includeArchived ? undefined : false,
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' as const } },
                { description: { contains: search, mode: 'insensitive' as const } },
                { publicId: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      include: REVIEW_PROTOCOL_INCLUDE,
      orderBy: [{ updatedAt: 'desc' }, { title: 'asc' }],
    });
  }

  async findAvailable(search?: string) {
    return this.prisma.reviewProtocol.findMany({
      where: {
        isArchived: false,
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' as const } },
                { description: { contains: search, mode: 'insensitive' as const } },
                { publicId: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      include: REVIEW_PROTOCOL_INCLUDE,
      orderBy: [{ updatedAt: 'desc' }, { title: 'asc' }],
    });
  }

  async findById(id: string) {
    const protocol = await this.prisma.reviewProtocol.findFirst({
      where: { OR: [{ id }, { publicId: id }] },
      include: REVIEW_PROTOCOL_INCLUDE,
    });

    if (!protocol) {
      throw new NotFoundException('Протокол проверки не найден');
    }

    return protocol;
  }

  async create(dto: CreateReviewProtocolDto, userId: string) {
    const title = dto.title.trim();
    const items = this.normalizeItems(dto.items);

    if (!title) {
      throw new BadRequestException('Укажите название протокола');
    }

    return this.prisma.reviewProtocol.create({
      data: {
        publicId: await this.generatePublicId(),
        title,
        description: dto.description?.trim() || null,
        createdById: userId,
        updatedById: userId,
        items: {
          create: items.map((item, index) => ({
            text: item.text,
            sortOrder: item.sortOrder ?? index,
          })),
        },
      },
      include: REVIEW_PROTOCOL_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateReviewProtocolDto, userId: string) {
    const protocol = await this.findById(id);

    const title = dto.title !== undefined ? dto.title.trim() : protocol.title;
    const items = dto.items ? this.normalizeItems(dto.items) : protocol.items;

    if (!title) {
      throw new BadRequestException('Укажите название протокола');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.reviewProtocolItem.deleteMany({ where: { protocolId: protocol.id } });

      return tx.reviewProtocol.update({
        where: { id: protocol.id },
        data: {
          title,
          description: dto.description !== undefined ? dto.description?.trim() || null : protocol.description,
          updatedById: userId,
          items: {
            create: items.map((item, index) => ({
              text: item.text,
              sortOrder: item.sortOrder ?? index,
            })),
          },
        },
        include: REVIEW_PROTOCOL_INCLUDE,
      });
    });
  }

  async toggleArchive(id: string, userId: string) {
    const protocol = await this.findById(id);

    return this.prisma.reviewProtocol.update({
      where: { id: protocol.id },
      data: {
        isArchived: !protocol.isArchived,
        updatedById: userId,
      },
      include: REVIEW_PROTOCOL_INCLUDE,
    });
  }

  async delete(id: string) {
    const protocol = await this.findById(id);
    await this.prisma.reviewProtocol.delete({ where: { id: protocol.id } });
    return { message: 'Протокол проверки удалён' };
  }

  async getCardProtocol(cardId: string) {
    const card = await this.getCard(cardId);
    return this.prisma.cardReviewProtocol.findUnique({
      where: { cardId: card.id },
      include: {
        sourceProtocol: {
          select: {
            id: true,
            publicId: true,
            title: true,
          },
        },
        items: {
          include: {
            checkedBy: { select: { id: true, fullName: true } },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }

  async attachToCard(cardId: string, protocolId: string, userId: string, userRole?: UserRole) {
    const card = await this.getCard(cardId);
    this.assertCanManageCardProtocol(card, userId, userRole);
    const protocol = await this.findById(protocolId);

    if (protocol.isArchived) {
      throw new BadRequestException('К карточке можно прикрепить только активный протокол');
    }

    return this.replaceCardProtocolSnapshot(card.id, protocol, userId);
  }

  async detachFromCard(cardId: string, userId: string, userRole?: UserRole) {
    const card = await this.getCard(cardId);
    this.assertCanManageCardProtocol(card, userId, userRole);

    await this.prisma.cardReviewProtocol.deleteMany({ where: { cardId: card.id } });
    return { message: 'Протокол проверки откреплён от карточки' };
  }

  async toggleCardItem(cardId: string, itemId: string, userId: string, userRole?: UserRole) {
    const card = await this.getCard(cardId);
    this.assertCanCheckCardProtocol(card, userId, userRole);

    const item = await this.prisma.cardReviewProtocolItem.findFirst({
      where: {
        id: itemId,
        cardProtocol: { cardId: card.id },
      },
    });

    if (!item) {
      throw new NotFoundException('Пункт протокола не найден');
    }

    const nextChecked = !item.isChecked;

    return this.prisma.cardReviewProtocolItem.update({
      where: { id: item.id },
      data: {
        isChecked: nextChecked,
        checkedAt: nextChecked ? new Date() : null,
        checkedById: nextChecked ? userId : null,
      },
      include: {
        checkedBy: { select: { id: true, fullName: true } },
      },
    });
  }

  async getDataSourceProtocol(dataSourceId: string) {
    const source = await this.getDataSource(dataSourceId);
    if (!source.reviewProtocolId) {
      return null;
    }

    return this.findById(source.reviewProtocolId);
  }

  async attachToDataSource(dataSourceId: string, protocolId: string, userRole?: UserRole) {
    this.assertCanManageDataSourceProtocol(userRole);
    const source = await this.getDataSource(dataSourceId);
    const protocol = await this.findById(protocolId);

    if (protocol.isArchived) {
      throw new BadRequestException('К источнику можно прикрепить только активный протокол');
    }

    return this.prisma.dataSource.update({
      where: { id: source.id },
      data: { reviewProtocolId: protocol.id },
      include: {
        reviewProtocol: { include: REVIEW_PROTOCOL_INCLUDE },
      },
    });
  }

  async detachFromDataSource(dataSourceId: string, userRole?: UserRole) {
    this.assertCanManageDataSourceProtocol(userRole);
    const source = await this.getDataSource(dataSourceId);

    return this.prisma.dataSource.update({
      where: { id: source.id },
      data: { reviewProtocolId: null },
      include: {
        reviewProtocol: { include: REVIEW_PROTOCOL_INCLUDE },
      },
    });
  }

  async copyFromDataSourceToCard(cardId: string, dataSourceId: string | null | undefined, userId: string) {
    if (!dataSourceId) {
      return;
    }

    const source = await this.prisma.dataSource.findUnique({
      where: { id: dataSourceId },
      include: {
        reviewProtocol: {
          include: REVIEW_PROTOCOL_INCLUDE,
        },
      },
    });

    if (!source?.reviewProtocol || source.reviewProtocol.isArchived) {
      return;
    }

    await this.replaceCardProtocolSnapshot(cardId, source.reviewProtocol, userId);
  }

  async resetCardProtocolChecks(cardId: string) {
    const protocol = await this.prisma.cardReviewProtocol.findUnique({
      where: { cardId },
      select: { id: true },
    });

    if (!protocol) {
      return;
    }

    await this.prisma.cardReviewProtocolItem.updateMany({
      where: { cardProtocolId: protocol.id },
      data: {
        isChecked: false,
        checkedAt: null,
        checkedById: null,
      },
    });
  }

  async assertCardProtocolCompleted(cardId: string) {
    const protocol = await this.prisma.cardReviewProtocol.findUnique({
      where: { cardId },
      include: { items: true },
    });

    if (!protocol) {
      return;
    }

    if (protocol.items.length === 0) {
      throw new BadRequestException('В протоколе проверки нет ни одного пункта');
    }

    const hasUnchecked = protocol.items.some((item) => !item.isChecked);
    if (hasUnchecked) {
      throw new BadRequestException(
        'Нельзя перевести карточку в статус "Готово", пока не отмечены все пункты протокола проверки',
      );
    }
  }

  private normalizeItems(items: Array<{ text: string; sortOrder?: number }>) {
    const normalized = items
      .map((item, index) => ({
        text: item.text?.trim(),
        sortOrder: item.sortOrder ?? index,
      }))
      .filter((item) => item.text);

    if (normalized.length === 0) {
      throw new BadRequestException('Добавьте хотя бы один пункт протокола');
    }

    return normalized;
  }

  private async replaceCardProtocolSnapshot(
    cardId: string,
    protocol: {
      id: string;
      title: string;
      description?: string | null;
      items: Array<{ text: string; sortOrder: number }>;
    },
    userId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.cardReviewProtocol.deleteMany({ where: { cardId } });

      return tx.cardReviewProtocol.create({
        data: {
          cardId,
          sourceProtocolId: protocol.id,
          title: protocol.title,
          description: protocol.description || null,
          createdById: userId,
          updatedById: userId,
          items: {
            create: protocol.items.map((item, index) => ({
              text: item.text,
              sortOrder: item.sortOrder ?? index,
            })),
          },
        },
        include: {
          sourceProtocol: {
            select: {
              id: true,
              publicId: true,
              title: true,
            },
          },
          items: {
            include: {
              checkedBy: { select: { id: true, fullName: true } },
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
      });
    });
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
    const source = await this.prisma.dataSource.findUnique({ where: { id } });
    if (!source) {
      throw new NotFoundException('Источник данных не найден');
    }
    return source;
  }

  private assertCanManageCardProtocol(card: any, userId: string, userRole?: UserRole) {
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
      throw new ForbiddenException('Недостаточно прав для управления протоколом карточки');
    }
  }

  private assertCanCheckCardProtocol(card: any, userId: string, userRole?: UserRole) {
    if (userRole === UserRole.ADMIN) {
      return;
    }

    if (card.status !== CardStatus.REVIEW || card.reviewerId !== userId) {
      throw new ForbiddenException('Отмечать пункты протокола может только проверяющий на этапе проверки');
    }
  }

  private assertCanManageDataSourceProtocol(userRole?: UserRole) {
    if (userRole === UserRole.ADMIN || userRole === UserRole.MANAGER) {
      return;
    }

    throw new ForbiddenException('Недостаточно прав для управления протоколом источника');
  }

  private async generatePublicId() {
    const year = new Date().getFullYear();
    const prefix = `PRT-${year}-`;

    const last = await this.prisma.reviewProtocol.findFirst({
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
}
