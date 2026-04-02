import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { CardStatus, MaterialType, NotificationType, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { CreateResultVersionDto } from './dto/create-result-version.dto';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ResultsService {
  private readonly zipSizeLimit: number;

  constructor(
    private prisma: PrismaService,
    private filesService: FilesService,
    private config: ConfigService,
    private notifications: NotificationsService,
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
    userRole: UserRole | undefined,
    files?: Express.Multer.File[],
  ) {
    const card = await this.getCard(cardId);
    if (card.isLocked) throw new ForbiddenException('Карточка закрыта');
    this.assertCanManageWorkingResult(card, userId, userRole);
    cardId = card.id; // use UUID

    const preparedLinks = dto.links || [];
    if ((!files || files.length === 0) && preparedLinks.length === 0) {
      throw new BadRequestException('Результат должен содержать хотя бы один файл или ссылку');
    }

    const lastVersion = await this.prisma.resultVersion.findFirst({
      where: { cardId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    const versionNumber = (lastVersion?.versionNumber || 0) + 1;

    const preparedFiles: Array<{
      relativePath: string;
      fileSize: number;
      fileHash: string;
      originalName: string;
      mimeType: string;
    }> = [];

    try {
      for (const file of files || []) {
        const subdir = `results/${cardId}/v${versionNumber}`;
        const savedFile = await this.filesService.saveUploadedFile(file, subdir);
        preparedFiles.push({
          ...savedFile,
          originalName: file.originalname,
          mimeType: file.mimetype,
        });
      }

      const createdVersion = await this.prisma.$transaction(async (tx) => {
        await tx.resultVersion.updateMany({
          where: { cardId, isCurrent: true },
          data: { isCurrent: false },
        });

        const version = await tx.resultVersion.create({
          data: {
            cardId,
            versionNumber,
            createdById: userId,
            comment: dto.comment,
            statusContext: card.status,
            isCurrent: true,
          },
        });

        if (preparedFiles.length > 0) {
          await tx.resultItem.createMany({
            data: preparedFiles.map((file) => ({
              resultVersionId: version.id,
              itemType: MaterialType.FILE,
              title: file.originalName,
              filePath: file.relativePath,
              fileName: file.originalName,
              fileSize: file.fileSize,
              mimeType: file.mimeType,
              fileHash: file.fileHash,
            })),
          });
        }

        if (preparedLinks.length > 0) {
          await tx.resultItem.createMany({
            data: preparedLinks.map((link) => ({
              resultVersionId: version.id,
              itemType: MaterialType.EXTERNAL_LINK,
              title: link.title || link.url,
              description: link.description,
              externalUrl: link.url,
            })),
          });
        }

        await tx.cardHistory.create({
          data: {
            cardId,
            userId,
            actionType: 'RESULT_ADDED',
            newValue: { versionNumber, itemCount: preparedFiles.length + preparedLinks.length },
          },
        });

        return tx.resultVersion.findUnique({
          where: { id: version.id },
          include: {
            createdBy: { select: { id: true, fullName: true } },
            items: true,
          },
        });
      });

      await this.notifications.createForCardEvent(cardId, {
        type: NotificationType.RESULT_ADDED,
        title: 'Загружен новый результат',
        message: `По карточке «${this.getCardDisplayName(card)}» загружена версия результата №${versionNumber}.`,
        actorId: userId,
        excludeUserIds: [userId],
      });

      return createdVersion;
    } catch (error) {
      await Promise.all(preparedFiles.map((file) => this.filesService.deleteFile(file.relativePath)));
      throw error;
    }
  }

  async downloadVersionAll(cardId: string, versionId: string, res: Response) {
    const card = await this.getCard(cardId);
    const version = await this.prisma.resultVersion.findFirst({
      where: { id: versionId, cardId: card.id },
      include: { items: true },
    });

    if (!version) throw new NotFoundException('Версия результата не найдена');

    const files = version.items
      .filter((i) => i.itemType === MaterialType.FILE && i.filePath)
      .filter((i) => this.filesService.fileExists(i.filePath!))
      .map((i) => ({ relativePath: i.filePath!, fileName: i.fileName || 'file' }));

    if (files.length === 0) throw new BadRequestException('Нет файлов для скачивания');

    const totalSize = await this.filesService.getTotalSize(files.map((f) => f.relativePath));
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
    const card = await this.getCard(cardId);
    const item = await this.prisma.resultItem.findFirst({
      where: { id: itemId, resultVersionId: versionId },
    });

    if (!item || !item.filePath) throw new NotFoundException('Файл не найден');

    const version = await this.prisma.resultVersion.findFirst({
      where: { id: versionId, cardId: card.id },
    });
    if (!version) throw new NotFoundException('Версия не найдена');

    const stream = this.filesService.getReadStream(item.filePath);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(item.fileName || 'file')}`);
    res.setHeader('Content-Type', item.mimeType || 'application/octet-stream');
    stream.pipe(res);
  }

  async deleteItem(cardId: string, versionId: string, itemId: string, userId: string, userRole?: UserRole) {
    const card = await this.getCard(cardId);
    if (card.isLocked) throw new ForbiddenException('Карточка закрыта');
    this.assertCanManageWorkingResult(card, userId, userRole);

    const item = await this.prisma.resultItem.findFirst({
      where: { id: itemId, resultVersionId: versionId },
    });
    if (!item) throw new NotFoundException('Элемент не найден');

    if (item.filePath) await this.filesService.deleteFile(item.filePath);
    await this.prisma.resultItem.delete({ where: { id: itemId } });

    return { message: 'Элемент удалён' };
  }

  private async getCard(cardId: string) {
    const card = await this.prisma.card.findFirst({
      where: { OR: [{ id: cardId }, { publicId: cardId }] },
      include: {
        dataSource: { select: { name: true } },
      },
    });
    if (!card) throw new NotFoundException('Карточка не найдена');
    return card;
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

  private assertCanManageWorkingResult(card: any, userId: string, userRole?: UserRole) {
    if (userRole === UserRole.ADMIN) {
      return;
    }

    if (card.status !== CardStatus.IN_PROGRESS || card.executorId !== userId) {
      throw new ForbiddenException(
        'Загружать и изменять результаты может только исполнитель, пока карточка находится в статусе "В работе"',
      );
    }
  }
}
