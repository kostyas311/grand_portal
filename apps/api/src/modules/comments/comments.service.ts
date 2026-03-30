import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

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

  async create(cardId: string, dto: CreateCommentDto, userId: string) {
    const card = await this.resolveCard(cardId);

    return this.prisma.reviewComment.create({
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
