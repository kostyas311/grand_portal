import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDataSourceDto } from './dto/create-data-source.dto';
import { UpdateDataSourceDto } from './dto/update-data-source.dto';

@Injectable()
export class DataSourcesService {
  constructor(private prisma: PrismaService) {}

  async findAll(search?: string, includeArchived = false) {
    return this.prisma.dataSource.findMany({
      where: {
        isActive: includeArchived ? undefined : true,
        ...(search
          ? { name: { contains: search, mode: 'insensitive' as const } }
          : {}),
      },
      orderBy: { name: 'asc' },
      include: {
        createdBy: {
          select: { id: true, fullName: true },
        },
        _count: { select: { cards: true } },
      },
    });
  }

  async findById(id: string) {
    const source = await this.prisma.dataSource.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, fullName: true } },
        _count: { select: { cards: true } },
      },
    });
    if (!source) throw new NotFoundException('Источник данных не найден');
    return source;
  }

  async create(dto: CreateDataSourceDto, userId: string) {
    const existing = await this.prisma.dataSource.findFirst({
      where: { name: dto.name },
    });
    if (existing) throw new ConflictException('Источник с таким названием уже существует');

    return this.prisma.dataSource.create({
      data: {
        name: dto.name,
        description: dto.description,
        website: dto.website,
        createdById: userId,
      },
      include: {
        createdBy: { select: { id: true, fullName: true } },
      },
    });
  }

  async update(id: string, dto: UpdateDataSourceDto) {
    await this.findById(id);

    if (dto.name) {
      const existing = await this.prisma.dataSource.findFirst({
        where: { name: dto.name, id: { not: id } },
      });
      if (existing) throw new ConflictException('Источник с таким названием уже существует');
    }

    return this.prisma.dataSource.update({
      where: { id },
      data: { name: dto.name, description: dto.description, website: dto.website },
      include: {
        createdBy: { select: { id: true, fullName: true } },
      },
    });
  }

  async toggleArchive(id: string) {
    const source = await this.findById(id);
    return this.prisma.dataSource.update({
      where: { id },
      data: { isActive: !source.isActive },
      include: {
        createdBy: { select: { id: true, fullName: true } },
      },
    });
  }

  async delete(id: string) {
    const source = await this.findById(id);
    if (source._count.cards > 0) {
      throw new BadRequestException(
        `Невозможно удалить источник: он используется в ${source._count.cards} карточках`,
      );
    }
    await this.prisma.dataSource.delete({ where: { id } });
    return { message: 'Источник удалён' };
  }
}
