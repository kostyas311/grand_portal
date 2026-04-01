import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CardStatus, InstructionStatus, NotificationType, UserRole } from '@prisma/client';
import { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateInstructionDto } from './dto/create-instruction.dto';
import { ListInstructionsDto } from './dto/list-instructions.dto';
import { UpdateInstructionDto } from './dto/update-instruction.dto';

const INSTRUCTION_INCLUDE = {
  folder: { select: { id: true, name: true } },
  createdBy: { select: { id: true, fullName: true, email: true } },
  updatedBy: { select: { id: true, fullName: true } },
  attachments: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      fileName: true,
      fileSize: true,
      mimeType: true,
      createdAt: true,
      uploadedBy: { select: { id: true, fullName: true } },
    },
  },
  cardLinks: {
    orderBy: { createdAt: 'desc' as const },
    select: {
      id: true,
      createdAt: true,
      card: {
        select: {
          id: true,
          publicId: true,
          updatedAt: true,
          extraTitle: true,
          status: true,
          dataSource: { select: { name: true } },
        },
      },
    },
  },
  _count: {
    select: {
      attachments: true,
      cardLinks: true,
    },
  },
};

@Injectable()
export class InstructionsService {
  private readonly maxAttachmentSize = 10 * 1024 * 1024;

  constructor(
    private prisma: PrismaService,
    private filesService: FilesService,
    private notifications: NotificationsService,
  ) {}

  async listFolders() {
    return this.prisma.instructionFolder.findMany({
      include: {
        parent: { select: { id: true, name: true } },
        _count: {
          select: {
            instructions: true,
            children: true,
          },
        },
      },
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
    });
  }

  async findAll(query: ListInstructionsDto, userId: string, userRole?: UserRole) {
    const where: any = {};

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { summary: { contains: query.search, mode: 'insensitive' } },
        { contentHtml: { contains: query.search, mode: 'insensitive' } },
        { publicId: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.folderId) {
      where.folderId = query.folderId;
    }

    if (query.mineOnly) {
      where.createdById = userId;
    }

    if (query.status) {
      where.status = query.status;
    }

    where.AND = [
      ...(where.AND || []),
      this.buildVisibilityClause(userId, userRole, query.status),
    ];

    return this.prisma.instruction.findMany({
      where,
      include: INSTRUCTION_INCLUDE,
      orderBy: [{ updatedAt: 'desc' }, { title: 'asc' }],
    });
  }

  async findPublished() {
    return this.prisma.instruction.findMany({
      where: { status: InstructionStatus.PUBLISHED },
      include: {
        folder: { select: { id: true, name: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
      orderBy: [{ updatedAt: 'desc' }, { title: 'asc' }],
    });
  }

  async findById(id: string, userId: string, userRole?: UserRole) {
    const instruction = await this.prisma.instruction.findFirst({
      where: {
        OR: [{ id }, { publicId: id }],
      },
      include: INSTRUCTION_INCLUDE,
    });

    if (!instruction) {
      throw new NotFoundException('Инструкция не найдена');
    }

    this.assertCanViewInstruction(instruction, userId, userRole);
    return instruction;
  }

  async create(dto: CreateInstructionDto, userId: string) {
    const folderId = await this.resolveFolderId(dto.folderId, dto.newFolderName, userId);
    const publicId = await this.generatePublicId();
    const cleanTitle = dto.title.trim();

    if (!cleanTitle) {
      throw new BadRequestException('Укажите название инструкции');
    }

    if (!dto.contentHtml?.trim()) {
      throw new BadRequestException('Заполните содержимое инструкции');
    }

    return this.prisma.instruction.create({
      data: {
        publicId,
        title: cleanTitle,
        summary: dto.summary?.trim() || null,
        contentHtml: dto.contentHtml,
        status: dto.status,
        folderId,
        createdById: userId,
        updatedById: userId,
        publishedAt: dto.status === InstructionStatus.PUBLISHED ? new Date() : null,
      },
      include: INSTRUCTION_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateInstructionDto, userId: string, userRole?: UserRole) {
    const instruction = await this.findById(id, userId, userRole);
    this.assertCanEditInstruction(instruction, userId, userRole);

    const nextStatus = dto.status ?? instruction.status;
    const nextTitle = dto.title !== undefined ? dto.title.trim() : instruction.title;
    const nextContentHtml = dto.contentHtml !== undefined ? dto.contentHtml : instruction.contentHtml;

    if (!nextTitle) {
      throw new BadRequestException('Укажите название инструкции');
    }

    if (!nextContentHtml?.trim()) {
      throw new BadRequestException('Заполните содержимое инструкции');
    }

    const folderId = await this.resolveFolderId(
      dto.folderId !== undefined ? dto.folderId : instruction.folderId ?? undefined,
      dto.newFolderName,
      userId,
    );

    return this.prisma.instruction.update({
      where: { id: instruction.id },
      data: {
        title: nextTitle,
        summary: dto.summary !== undefined ? dto.summary?.trim() || null : instruction.summary,
        contentHtml: nextContentHtml,
        status: nextStatus,
        folderId,
        updatedById: userId,
        publishedAt:
          nextStatus === InstructionStatus.PUBLISHED
            ? instruction.status === InstructionStatus.PUBLISHED
              ? instruction.publishedAt
              : new Date()
            : null,
      },
      include: INSTRUCTION_INCLUDE,
    });
  }

  async remove(id: string, userId: string, userRole?: UserRole) {
    const instruction = await this.findById(id, userId, userRole);
    this.assertCanEditInstruction(instruction, userId, userRole);

    const attachments = await this.prisma.instructionAttachment.findMany({
      where: { instructionId: instruction.id },
    });

    attachments.forEach((attachment) => this.filesService.deleteFile(attachment.filePath));
    await this.prisma.instruction.delete({ where: { id: instruction.id } });

    return { message: 'Инструкция удалена' };
  }

  async uploadAttachments(
    id: string,
    userId: string,
    userRole: UserRole | undefined,
    files: Express.Multer.File[] = [],
  ) {
    if (!files.length) {
      throw new BadRequestException('Файлы не загружены');
    }

    const instruction = await this.findById(id, userId, userRole);
    this.assertCanEditInstruction(instruction, userId, userRole);

    const uploaded = [];

    for (const file of files) {
      if (file.size > this.maxAttachmentSize) {
        throw new BadRequestException(`Файл «${file.originalname}» превышает лимит 10 МБ`);
      }

      const { relativePath, fileSize, fileHash } = await this.filesService.saveFile(
        file.buffer,
        file.originalname,
        `instructions/${instruction.id}/attachments`,
      );

      const attachment = await this.prisma.instructionAttachment.create({
        data: {
          instructionId: instruction.id,
          filePath: relativePath,
          fileName: file.originalname,
          fileSize,
          mimeType: file.mimetype,
          fileHash,
          uploadedById: userId,
        },
        include: {
          uploadedBy: { select: { id: true, fullName: true } },
        },
      });

      uploaded.push(attachment);
    }

    return uploaded;
  }

  async deleteAttachment(
    id: string,
    attachmentId: string,
    userId: string,
    userRole?: UserRole,
  ) {
    const instruction = await this.findById(id, userId, userRole);
    this.assertCanEditInstruction(instruction, userId, userRole);

    const attachment = await this.prisma.instructionAttachment.findFirst({
      where: {
        id: attachmentId,
        instructionId: instruction.id,
      },
    });

    if (!attachment) {
      throw new NotFoundException('Вложение не найдено');
    }

    this.filesService.deleteFile(attachment.filePath);
    await this.prisma.instructionAttachment.delete({ where: { id: attachment.id } });

    return { message: 'Вложение удалено' };
  }

  async downloadAttachment(
    id: string,
    attachmentId: string,
    userId: string,
    userRole: UserRole | undefined,
    res: Response,
  ) {
    const instruction = await this.findById(id, userId, userRole);

    const attachment = await this.prisma.instructionAttachment.findFirst({
      where: {
        id: attachmentId,
        instructionId: instruction.id,
      },
    });

    if (!attachment) {
      throw new NotFoundException('Вложение не найдено');
    }

    const stream = this.filesService.getReadStream(attachment.filePath);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
    );
    res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
    stream.pipe(res);
  }

  async getCardInstructions(cardId: string, userId: string, userRole?: UserRole) {
    const card = await this.getCard(cardId);

    const links = await this.prisma.cardInstruction.findMany({
      where: { cardId: card.id },
      include: {
        instruction: {
          include: {
            folder: { select: { id: true, name: true } },
            createdBy: { select: { id: true, fullName: true } },
            _count: {
              select: {
                attachments: true,
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return links
      .filter((link) => this.canViewInstruction(link.instruction, userId, userRole))
      .map((link) => ({
        id: link.id,
        createdAt: link.createdAt,
        instruction: link.instruction,
      }));
  }

  async attachToCard(
    cardId: string,
    instructionId: string,
    userId: string,
    userRole?: UserRole,
  ) {
    const card = await this.getCard(cardId);
    this.assertCanManageCardInstructions(card, userId, userRole);

    const instruction = await this.findById(instructionId, userId, userRole);
    if (instruction.status !== InstructionStatus.PUBLISHED) {
      throw new BadRequestException('В карточку можно вложить только опубликованную инструкцию');
    }

    const link = await this.prisma.cardInstruction.upsert({
      where: {
        cardId_instructionId: {
          cardId: card.id,
          instructionId: instruction.id,
        },
      },
      update: {},
      create: {
        cardId: card.id,
        instructionId: instruction.id,
        createdById: userId,
      },
      include: {
        instruction: {
          include: {
            folder: { select: { id: true, name: true } },
            createdBy: { select: { id: true, fullName: true } },
          },
        },
      },
    });

    await this.notifications.createForCardEvent(card.id, {
      type: NotificationType.CARD_UPDATED,
      title: 'Инструкция вложена в карточку',
      message: `В карточку «${this.getCardDisplayName(card)}» добавлена инструкция «${instruction.title}».`,
      actorId: userId,
      excludeUserIds: [userId],
    });

    return link;
  }

  async detachFromCard(
    cardId: string,
    instructionId: string,
    userId: string,
    userRole?: UserRole,
  ) {
    const card = await this.getCard(cardId);
    this.assertCanManageCardInstructions(card, userId, userRole);

    const link = await this.prisma.cardInstruction.findFirst({
      where: {
        cardId: card.id,
        instruction: {
          OR: [{ id: instructionId }, { publicId: instructionId }],
        },
      },
      include: {
        instruction: {
          select: {
            title: true,
          },
        },
      },
    });

    if (!link) {
      throw new NotFoundException('Привязанная инструкция не найдена');
    }

    await this.prisma.cardInstruction.delete({ where: { id: link.id } });

    await this.notifications.createForCardEvent(card.id, {
      type: NotificationType.CARD_UPDATED,
      title: 'Инструкция откреплена от карточки',
      message: `Из карточки «${this.getCardDisplayName(card)}» убрана инструкция «${link.instruction.title}».`,
      actorId: userId,
      excludeUserIds: [userId],
    });

    return { message: 'Инструкция откреплена от карточки' };
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

  private async resolveFolderId(folderId: string | undefined, newFolderName: string | undefined, userId: string) {
    const trimmedNewFolderName = newFolderName?.trim();

    if (trimmedNewFolderName) {
      const parentFolderId = folderId || null;
      const existing = await this.prisma.instructionFolder.findFirst({
        where: {
          parentId: parentFolderId,
          name: { equals: trimmedNewFolderName, mode: 'insensitive' },
        },
      });

      if (existing) {
        return existing.id;
      }

      const folder = await this.prisma.instructionFolder.create({
        data: {
          name: trimmedNewFolderName,
          parentId: parentFolderId,
          createdById: userId,
        },
      });

      return folder.id;
    }

    if (!folderId) {
      return null;
    }

    const folder = await this.prisma.instructionFolder.findUnique({
      where: { id: folderId },
    });

    if (!folder) {
      throw new NotFoundException('Каталог инструкции не найден');
    }

    return folder.id;
  }

  private assertCanViewInstruction(instruction: any, userId: string, userRole?: UserRole) {
    if (!this.canViewInstruction(instruction, userId, userRole)) {
      throw new ForbiddenException('Недостаточно прав для просмотра инструкции');
    }
  }

  private canViewInstruction(instruction: any, userId: string, userRole?: UserRole) {
    if (userRole === UserRole.ADMIN) {
      return true;
    }

    if (instruction.status === InstructionStatus.PUBLISHED) {
      return true;
    }

    return instruction.createdById === userId;
  }

  private assertCanEditInstruction(instruction: any, userId: string, userRole?: UserRole) {
    if (userRole === UserRole.ADMIN) {
      return;
    }

    if (instruction.createdById !== userId) {
      throw new ForbiddenException('Редактировать инструкцию может только автор или администратор');
    }
  }

  private assertCanManageCardInstructions(card: any, userId: string, userRole?: UserRole) {
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
      throw new ForbiddenException('Недостаточно прав для изменения инструкций карточки');
    }
  }

  private buildVisibilityClause(userId: string, userRole?: UserRole, explicitStatus?: InstructionStatus) {
    if (userRole === UserRole.ADMIN) {
      return {};
    }

    if (explicitStatus === InstructionStatus.PUBLISHED) {
      return { status: InstructionStatus.PUBLISHED };
    }

    return {
      OR: [
        { status: InstructionStatus.PUBLISHED },
        { createdById: userId },
      ],
    };
  }

  private async generatePublicId(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INS-${year}-`;

    const last = await this.prisma.instruction.findFirst({
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
