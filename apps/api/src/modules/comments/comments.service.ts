import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CardStatus, NotificationType, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CommentsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  private getCardDisplayName(card: {
    publicId: string;
    extraTitle?: string | null;
    dataSourceId?: string | null;
  }) {
    return card.extraTitle || card.publicId;
  }

  private formatCommentForNotification(text: string) {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return '';
    }

    return normalized.length > 220 ? `${normalized.slice(0, 217)}...` : normalized;
  }

  private async resolveCard(cardId: string) {
    const card = await this.prisma.card.findFirst({
      where: { OR: [{ id: cardId }, { publicId: cardId }] },
    });
    if (!card) throw new NotFoundException('Карточка не найдена');
    return card;
  }

  async findAll(cardId: string) {
    const card = await this.resolveCard(cardId);
    return this.prisma.reviewComment.findMany({
      where: { cardId: card.id },
      include: {
        author: { select: { id: true, fullName: true } },
        resultVersion: { select: { id: true, versionNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(cardId: string, dto: CreateCommentDto, userId: string, userRole?: UserRole) {
    const card = await this.resolveCard(cardId);

    if (userRole !== UserRole.ADMIN) {
      const canCommentInformationalCard =
        card.withoutSourceMaterials &&
        !card.isLocked &&
        (card.createdById === userId || card.executorId === userId || card.reviewerId === userId);

      if (!canCommentInformationalCard && (card.status !== CardStatus.REVIEW || card.reviewerId !== userId)) {
        throw new ForbiddenException(
          'Комментарии проверки может оставлять только проверяющий, пока карточка находится в статусе "На проверке"',
        );
      }
    }

    const comment = await this.prisma.reviewComment.create({
      data: {
        cardId: card.id,
        authorId: userId,
        resultVersionId: dto.resultVersionId,
        text: dto.text,
      },
      include: {
        author: { select: { id: true, fullName: true } },
        resultVersion: { select: { id: true, versionNumber: true } },
      },
    });

    await this.notifications.createForCardEvent(card.id, {
      type: NotificationType.COMMENT_ADDED,
      title: 'Новый комментарий по карточке',
      message: `По карточке «${this.getCardDisplayName(card)}» оставлен комментарий: «${this.formatCommentForNotification(dto.text)}»`,
      actorId: userId,
      extraUserIds: [card.createdById, card.executorId, card.reviewerId],
      excludeUserIds: [userId],
    });

    return comment;
  }

  async delete(cardId: string, commentId: string) {
    const comment = await this.prisma.reviewComment.findFirst({
      where: { id: commentId, cardId },
    });
    if (!comment) throw new NotFoundException('Комментарий не найден');
    await this.prisma.reviewComment.delete({ where: { id: commentId } });
    return { message: 'Комментарий удалён' };
  }
}
