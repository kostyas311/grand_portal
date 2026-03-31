import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { CardStatus, MaterialType, NotificationType, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { AddMaterialDto } from './dto/add-material.dto';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SourceMaterialsService {
  private readonly zipSizeLimit: number;

  constructor(
    private prisma: PrismaService,
    private filesService: FilesService,
    private config: ConfigService,
    private notifications: NotificationsService,
  ) {
    this.zipSizeLimit = config.get('ZIP_SIZE_LIMIT', 524288000);
  }

  async addMaterial(
    cardId: string,
    dto: AddMaterialDto,
    userId: string,
    userRole: UserRole | undefined,
    file?: Express.Multer.File,
  ) {
    const card = await this.getCard(cardId);
    if (card.isLocked) throw new ForbiddenException('Карточка закрыта');
    this.assertCanManageWorkingMaterials(card, userId, userRole);
    const resolvedCardId = card.id;

    if (dto.materialType === MaterialType.FILE) {
      if (!file) throw new BadRequestException('Файл не загружен');

      const subdir = `source-materials/${resolvedCardId}`;
      const { relativePath, fileSize, fileHash } = await this.filesService.saveFile(
        file.buffer,
        file.originalname,
        subdir,
      );

      const material = await this.prisma.sourceMaterial.create({
        data: {
          cardId: resolvedCardId,
          materialType: MaterialType.FILE,
          title: dto.title || file.originalname,
          description: dto.description,
          filePath: relativePath,
          fileName: file.originalname,
          fileSize,
          mimeType: file.mimetype,
          fileHash,
          uploadedById: userId,
        },
        include: { uploadedBy: { select: { id: true, fullName: true } } },
      });

      await this.prisma.cardHistory.create({
        data: {
          cardId: resolvedCardId,
          userId,
          actionType: 'SOURCE_MATERIAL_ADDED',
          newValue: { title: material.title, type: 'FILE' },
        },
      });

      await this.notifications.createForCardEvent(resolvedCardId, {
        type: NotificationType.SOURCE_MATERIAL_ADDED,
        title: 'Добавлены исходные данные',
        message: `В карточку «${card.extraTitle || card.publicId}» добавлен новый материал «${material.title}».`,
        actorId: userId,
        excludeUserIds: [userId],
      });

      return material;
    } else {
      if (!dto.externalUrl) throw new BadRequestException('URL не указан');

      const material = await this.prisma.sourceMaterial.create({
        data: {
          cardId: resolvedCardId,
          materialType: MaterialType.EXTERNAL_LINK,
          title: dto.title || dto.externalUrl,
          description: dto.description,
          externalUrl: dto.externalUrl,
          uploadedById: userId,
        },
        include: { uploadedBy: { select: { id: true, fullName: true } } },
      });

      await this.prisma.cardHistory.create({
        data: {
          cardId: resolvedCardId,
          userId,
          actionType: 'SOURCE_MATERIAL_ADDED',
          newValue: { title: material.title, type: 'EXTERNAL_LINK' },
        },
      });

      await this.notifications.createForCardEvent(resolvedCardId, {
        type: NotificationType.SOURCE_MATERIAL_ADDED,
        title: 'Добавлены исходные данные',
        message: `В карточку «${card.extraTitle || card.publicId}» добавлен новый материал «${material.title}».`,
        actorId: userId,
        excludeUserIds: [userId],
      });

      return material;
    }
  }

  async findAll(cardId: string) {
    const card = await this.getCard(cardId);
    return this.prisma.sourceMaterial.findMany({
      where: { cardId: card.id },
      include: { uploadedBy: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async download(cardId: string, materialId: string, res: Response) {
    const material = await this.prisma.sourceMaterial.findFirst({
      where: { id: materialId, cardId },
    });

    if (!material) throw new NotFoundException('Материал не найден');
    if (material.materialType !== MaterialType.FILE || !material.filePath) {
      throw new BadRequestException('Этот материал является ссылкой, не файлом');
    }

    const stream = this.filesService.getReadStream(material.filePath);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(material.fileName || 'file')}`);
    res.setHeader('Content-Type', material.mimeType || 'application/octet-stream');
    stream.pipe(res);
  }

  async downloadAll(cardId: string, res: Response) {
    await this.getCard(cardId);

    const materials = await this.prisma.sourceMaterial.findMany({
      where: { cardId, materialType: MaterialType.FILE },
    });

    const files = materials
      .filter((m) => m.filePath && this.filesService.fileExists(m.filePath))
      .map((m) => ({ relativePath: m.filePath!, fileName: m.fileName || 'file' }));

    if (files.length === 0) throw new BadRequestException('Нет файлов для скачивания');

    const totalSize = this.filesService.getTotalSize(files.map((f) => f.relativePath));
    if (totalSize > this.zipSizeLimit) {
      throw new BadRequestException(
        `Суммарный размер файлов (${Math.round(totalSize / 1024 / 1024)} MB) превышает лимит для ZIP-архива. Скачайте файлы по отдельности.`,
      );
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="materials_${cardId}.zip"`);

    const zipStream = await this.filesService.createZipStream(files);
    (zipStream as any).pipe(res);
  }

  async delete(cardId: string, materialId: string, userId: string, userRole?: UserRole) {
    const material = await this.prisma.sourceMaterial.findFirst({
      where: { id: materialId, cardId },
    });

    if (!material) throw new NotFoundException('Материал не найден');

    const card = await this.getCard(cardId);
    if (card.isLocked) throw new ForbiddenException('Карточка закрыта');
    this.assertCanManageWorkingMaterials(card, userId, userRole);

    if (material.filePath) {
      this.filesService.deleteFile(material.filePath);
    }

    await this.prisma.sourceMaterial.delete({ where: { id: materialId } });

    await this.prisma.cardHistory.create({
      data: {
        cardId,
        userId,
        actionType: 'SOURCE_MATERIAL_REMOVED',
        oldValue: { title: material.title },
      },
    });

    return { message: 'Материал удалён' };
  }

  private async getCard(cardId: string) {
    const card = await this.prisma.card.findFirst({
      where: { OR: [{ id: cardId }, { publicId: cardId }] },
    });
    if (!card) throw new NotFoundException('Карточка не найдена');
    return card;
  }

  private assertCanManageWorkingMaterials(card: any, userId: string, userRole?: UserRole) {
    if (userRole === UserRole.ADMIN) {
      return;
    }

    if (card.status !== CardStatus.IN_PROGRESS || card.executorId !== userId) {
      throw new ForbiddenException(
        'Изменять исходные материалы может только исполнитель, пока карточка находится в статусе "В работе"',
      );
    }
  }
}
