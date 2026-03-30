import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { MaterialType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { CreateResultVersionDto } from './dto/create-result-version.dto';
import { AddResultItemDto } from './dto/add-result-item.dto';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';

@Injectable()
export class ResultsService {
  private readonly zipSizeLimit: number;

  constructor(
    private prisma: PrismaService,
    private filesService: FilesService,
    private config: ConfigService,
  ) {
    this.zipSizeLimit = config.get('ZIP_SIZE_LIMIT', 524288000);
  }

  async findVersions(cardId: string) {
    const card = await this.getCard(cardId);
    return this.prisma.resultVersion.findMany({
      where: { cardId: card.id },
      include: {
        createdBy: { select: { id: true, fullName: true } },
        items: true,
        _count: { select: { items: true, comments: true } },
      },
      orderBy: { versionNumber: 'desc' },
    });
  }

  async createVersion(
    cardId: string,
    dto: CreateResultVersionDto,
    userId: string,
    files?: Express.Multer.File[],
  ) {
    const card = await this.getCard(cardId);
    if (card.isLocked) throw new ForbiddenException('Карточка закрыта');
    cardId = card.id; // use UUID

    // Mark all previous versions as not current
    await this.prisma.resultVersion.updateMany({
      where: { cardId, isCurrent: true },
      data: { isCurrent: false },
    });

    // Get next version number
    const lastVersion = await this.prisma.resultVersion.findFirst({
      where: { cardId },
      orderBy: { versionNumber: 'desc' },
    });
    const versionNumber = (lastVersion?.versionNumber || 0) + 1;

    const version = await this.prisma.resultVersion.create({
      data: {
        cardId,
        versionNumber,
        createdById: userId,
        comment: dto.comment,
        statusContext: card.status,
        isCurrent: true,
      },
    });

    // Add items: files
    if (files && files.length > 0) {
      for (const file of files) {
        const subdir = `results/${cardId}/v${versionNumber}`;
        const { relativePath, fileSize, fileHash } = await this.filesService.saveFile(
          file.buffer,
          file.originalname,
          subdir,
        );

        await this.prisma.resultItem.create({
          data: {
            resultVersionId: version.id,
            itemType: MaterialType.FILE,
            title: file.originalname,
            filePath: relativePath,
            fileName: file.originalname,
            fileSize,
            mimeType: file.mimetype,
            fileHash,
          },
        });
      }
    }

    // Add items: external links
    if (dto.links && dto.links.length > 0) {
      for (const link of dto.links) {
        await this.prisma.resultItem.create({
          data: {
            resultVersionId: version.id,
            itemType: MaterialType.EXTERNAL_LINK,
            title: link.title || link.url,
            description: link.description,
            externalUrl: link.url,
          },
        });
      }
    }

    // Validate: version must have at least one item
    const itemCount = await this.prisma.resultItem.count({
      where: { resultVersionId: version.id },
    });
    if (itemCount === 0) {
      await this.prisma.resultVersion.delete({ where: { id: version.id } });
      throw new BadRequestException('Результат должен содержать хотя бы один файл или ссылку');
    }

    await this.prisma.cardHistory.create({
      data: {
        cardId,
        userId,
        actionType: 'RESULT_ADDED',
        newValue: { versionNumber, itemCount },
      },
    });

    return this.prisma.resultVersion.findUnique({
      where: { id: version.id },
      include: {
        createdBy: { select: { id: true, fullName: true } },
        items: true,
      },
    });
  }

  async downloadVersionAll(cardId: string, versionId: string, res: Response) {
    const version = await this.prisma.resultVersion.findFirst({
      where: { id: versionId, cardId },
      include: { items: true },
    });

    if (!version) throw new NotFoundException('Версия результата не найдена');

    const files = version.items
      .filter((i) => i.itemType === MaterialType.FILE && i.filePath)
      .filter((i) => this.filesService.fileExists(i.filePath!))
      .map((i) => ({ relativePath: i.filePath!, fileName: i.fileName || 'file' }));

    if (files.length === 0) throw new BadRequestException('Нет файлов для скачивания');

    const totalSize = this.filesService.getTotalSize(files.map((f) => f.relativePath));
    if (totalSize > this.zipSizeLimit) {
      throw new BadRequestException(
        `Суммарный размер (${Math.round(totalSize / 1024 / 1024)} MB) превышает лимит. Скачайте файлы по отдельности.`,
      );
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="result_v${version.versionNumber}.zip"`);

    const zipStream = await this.filesService.createZipStream(files);
    (zipStream as any).pipe(res);
  }

  async downloadItem(cardId: string, versionId: string, itemId: string, res: Response) {
    const item = await this.prisma.resultItem.findFirst({
      where: { id: itemId, resultVersionId: versionId },
    });

    if (!item || !item.filePath) throw new NotFoundException('Файл не найден');

    const version = await this.prisma.resultVersion.findFirst({
      where: { id: versionId, cardId },
    });
    if (!version) throw new NotFoundException('Версия не найдена');

    const stream = this.filesService.getReadStream(item.filePath);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(item.fileName || 'file')}`);
    res.setHeader('Content-Type', item.mimeType || 'application/octet-stream');
    stream.pipe(res);
  }

  async deleteItem(cardId: string, versionId: string, itemId: string, userId: string) {
    const card = await this.getCard(cardId);
    if (card.isLocked) throw new ForbiddenException('Карточка закрыта');

    const item = await this.prisma.resultItem.findFirst({
      where: { id: itemId, resultVersionId: versionId },
    });
    if (!item) throw new NotFoundException('Элемент не найден');

    if (item.filePath) this.filesService.deleteFile(item.filePath);
    await this.prisma.resultItem.delete({ where: { id: itemId } });

    return { message: 'Элемент удалён' };
  }

  private async getCard(cardId: string) {
    const card = await this.prisma.card.findFirst({
      where: { OR: [{ id: cardId }, { publicId: cardId }] },
    });
    if (!card) throw new NotFoundException('Карточка не найдена');
    return card;
  }
}
