import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HistoryService {
  constructor(private prisma: PrismaService) {}

  async findByCard(cardId: string) {
    return this.prisma.cardHistory.findMany({
      where: { cardId },
      include: {
        user: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
