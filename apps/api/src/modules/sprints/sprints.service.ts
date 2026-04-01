import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CardStatus, SprintStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';
import { CloseSprintDto } from './dto/close-sprint.dto';

const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

@Injectable()
export class SprintsService {
  private legacySyncPromise: Promise<void> | null = null;

  constructor(private prisma: PrismaService) {}

  async findAll() {
    await this.ensureLegacyCardSprints();

    return this.prisma.sprint.findMany({
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
      include: {
        _count: { select: { cards: true } },
      },
    });
  }

  async getCurrent() {
    await this.ensureLegacyCardSprints();

    return this.prisma.sprint.findFirst({
      where: { status: SprintStatus.IN_PROGRESS },
      orderBy: { startDate: 'desc' },
      include: {
        _count: { select: { cards: true } },
      },
    });
  }

  async getCurrentOrThrow() {
    const sprint = await this.getCurrent();

    if (!sprint) {
      throw new BadRequestException(
        'Сначала создайте активный спринт, чтобы можно было работать с карточками',
      );
    }

    return sprint;
  }

  async findById(id: string) {
    await this.ensureLegacyCardSprints();

    const sprint = await this.prisma.sprint.findUnique({
      where: { id },
      include: {
        _count: { select: { cards: true } },
      },
    });

    if (!sprint) {
      throw new NotFoundException('Спринт не найден');
    }

    return sprint;
  }

  async create(dto: CreateSprintDto) {
    await this.ensureLegacyCardSprints();
    this.assertDates(dto.startDate, dto.endDate);

    const activeSprint = await this.prisma.sprint.findFirst({
      where: { status: SprintStatus.IN_PROGRESS },
    });

    if (activeSprint) {
      throw new ConflictException(
        `Сначала завершите активный спринт «${activeSprint.name}»`,
      );
    }

    const existsByName = await this.prisma.sprint.findUnique({
      where: { name: dto.name.trim() },
    });

    if (existsByName) {
      throw new ConflictException('Спринт с таким названием уже существует');
    }

    return this.prisma.sprint.create({
      data: {
        name: dto.name.trim(),
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        status: SprintStatus.IN_PROGRESS,
      },
      include: {
        _count: { select: { cards: true } },
      },
    });
  }

  async update(id: string, dto: UpdateSprintDto) {
    const sprint = await this.findById(id);
    const nextStartDate = dto.startDate ?? sprint.startDate.toISOString();
    const nextEndDate = dto.endDate ?? sprint.endDate.toISOString();
    this.assertDates(nextStartDate, nextEndDate);

    if (dto.name && dto.name.trim() !== sprint.name) {
      const existing = await this.prisma.sprint.findUnique({
        where: { name: dto.name.trim() },
      });
      if (existing && existing.id !== sprint.id) {
        throw new ConflictException('Спринт с таким названием уже существует');
      }
    }

    return this.prisma.sprint.update({
      where: { id: sprint.id },
      data: {
        name: dto.name?.trim(),
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
      include: {
        _count: { select: { cards: true } },
      },
    });
  }

  async close(id: string, dto: CloseSprintDto) {
    const sprint = await this.findById(id);
    if (sprint.status === SprintStatus.CLOSED) {
      throw new BadRequestException('Спринт уже закрыт');
    }

    const shouldCreateNext =
      !!dto.nextSprintName || !!dto.nextSprintStartDate || !!dto.nextSprintEndDate;

    if (
      shouldCreateNext &&
      (!dto.nextSprintName || !dto.nextSprintStartDate || !dto.nextSprintEndDate)
    ) {
      throw new BadRequestException(
        'Для создания следующего спринта укажите название и обе границы',
      );
    }

    if (!shouldCreateNext && dto.transferOpenCards) {
      throw new BadRequestException(
        'Чтобы перенести незавершённые карточки, сначала задайте следующий спринт',
      );
    }

    if (shouldCreateNext) {
      this.assertDates(dto.nextSprintStartDate!, dto.nextSprintEndDate!);
      const existing = await this.prisma.sprint.findUnique({
        where: { name: dto.nextSprintName!.trim() },
      });
      if (existing && existing.id !== sprint.id) {
        throw new ConflictException('Следующий спринт с таким названием уже существует');
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const closedSprint = await tx.sprint.update({
        where: { id: sprint.id },
        data: { status: SprintStatus.CLOSED },
      });

      let nextSprint: any = null;

      if (shouldCreateNext) {
        nextSprint = await tx.sprint.create({
          data: {
            name: dto.nextSprintName!.trim(),
            startDate: new Date(dto.nextSprintStartDate!),
            endDate: new Date(dto.nextSprintEndDate!),
            status: SprintStatus.IN_PROGRESS,
          },
        });

        if (dto.transferOpenCards) {
          const { month, year } = this.getMonthYear(nextSprint.startDate);
          await tx.card.updateMany({
            where: {
              sprintId: sprint.id,
              status: {
                in: [CardStatus.NEW, CardStatus.IN_PROGRESS, CardStatus.REVIEW],
              },
            },
            data: {
              sprintId: nextSprint.id,
              month,
              year,
            },
          });
        }
      }

      return { closedSprint, nextSprint };
    });

    return result;
  }

  async transferOpenCards(fromSprintId: string, targetSprintId: string) {
    const [fromSprint, targetSprint] = await Promise.all([
      this.findById(fromSprintId),
      this.findById(targetSprintId),
    ]);

    if (fromSprint.id === targetSprint.id) {
      throw new BadRequestException('Нельзя переносить карточки в тот же самый спринт');
    }

    const { month, year } = this.getMonthYear(targetSprint.startDate);

    const moved = await this.prisma.card.updateMany({
      where: {
        sprintId: fromSprint.id,
        status: {
          in: [CardStatus.NEW, CardStatus.IN_PROGRESS, CardStatus.REVIEW],
        },
      },
      data: {
        sprintId: targetSprint.id,
        month,
        year,
      },
    });

    return {
      movedCount: moved.count,
      fromSprint: { id: fromSprint.id, name: fromSprint.name },
      targetSprint: { id: targetSprint.id, name: targetSprint.name },
    };
  }

  async ensureLegacyCardSprints() {
    if (this.legacySyncPromise) {
      await this.legacySyncPromise;
      return;
    }

    this.legacySyncPromise = this.syncLegacyCardSprints();
    try {
      await this.legacySyncPromise;
    } finally {
      this.legacySyncPromise = null;
    }
  }

  private async syncLegacyCardSprints() {
    const cards = await this.prisma.card.findMany({
      where: { sprintId: null },
      select: { id: true, month: true, year: true },
    });

    if (cards.length === 0) {
      return;
    }

    const activeSprint = await this.prisma.sprint.findFirst({
      where: { status: SprintStatus.IN_PROGRESS },
    });

    const activeMonthYear = activeSprint
      ? this.getMonthYear(activeSprint.startDate)
      : null;

    const sprintMap = new Map<string, string>();

    for (const card of cards) {
      const key = `${card.year}-${String(card.month).padStart(2, '0')}`;

      if (!sprintMap.has(key)) {
        let sprintId: string;

        if (
          activeSprint &&
          activeMonthYear &&
          activeMonthYear.month === card.month &&
          activeMonthYear.year === card.year
        ) {
          sprintId = activeSprint.id;
        } else {
          const name = this.getLegacySprintName(card.month, card.year);
          const existing = await this.prisma.sprint.findUnique({
            where: { name },
          });

          if (existing) {
            sprintId = existing.id;
          } else {
            const { startDate, endDate } = this.getMonthBounds(card.month, card.year);
            const created = await this.prisma.sprint.create({
              data: {
                name,
                startDate,
                endDate,
                status:
                  activeSprint || !this.isCurrentMonth(card.month, card.year)
                    ? SprintStatus.CLOSED
                    : SprintStatus.IN_PROGRESS,
              },
            });
            sprintId = created.id;
          }
        }

        sprintMap.set(key, sprintId);
      }

      await this.prisma.card.update({
        where: { id: card.id },
        data: { sprintId: sprintMap.get(key)! },
      });
    }
  }

  private assertDates(startDateRaw: string, endDateRaw: string) {
    const startDate = new Date(startDateRaw);
    const endDate = new Date(endDateRaw);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Укажите корректные границы спринта');
    }
    if (startDate > endDate) {
      throw new BadRequestException('Дата начала спринта не может быть позже даты окончания');
    }
  }

  private getMonthBounds(month: number, year: number) {
    return {
      startDate: new Date(Date.UTC(year, month - 1, 1)),
      endDate: new Date(Date.UTC(year, month, 0)),
    };
  }

  private getMonthYear(date: Date) {
    return {
      month: date.getUTCMonth() + 1,
      year: date.getUTCFullYear(),
    };
  }

  private getLegacySprintName(month: number, year: number) {
    return `${MONTH_NAMES[month - 1]} ${year}`;
  }

  private isCurrentMonth(month: number, year: number) {
    const now = new Date();
    return now.getUTCFullYear() === year && now.getUTCMonth() + 1 === month;
  }
}
