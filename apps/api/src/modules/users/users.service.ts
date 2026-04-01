import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ThemePreference, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  themePreference: true,
  isActive: true,
  position: true,
  phone: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(search?: string) {
    return this.prisma.user.findMany({
      where: search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: USER_SELECT,
      orderBy: { fullName: 'asc' },
    });
  }

  async findDirectory() {
    return this.prisma.user.findMany({
      where: {
        isActive: true,
        role: { not: UserRole.ADMIN },
      },
      select: USER_SELECT,
      orderBy: { fullName: 'asc' },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (!user) throw new NotFoundException('Пользователь не найден');
    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Пользователь с таким email уже существует');

    if (dto.role === UserRole.ADMIN) {
      const hasAnotherAdmin = await this.prisma.user.findFirst({
        where: { role: UserRole.ADMIN },
        select: { id: true },
      });

      if (hasAnotherAdmin) {
        throw new BadRequestException('Администратор в системе может быть только один');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        passwordHash,
        role: dto.role,
        isActive: true,
      },
      select: USER_SELECT,
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.findById(id);

    if (dto.email) {
      const existing = await this.prisma.user.findFirst({
        where: { email: dto.email, id: { not: id } },
      });
      if (existing) throw new ConflictException('Email уже используется');
    }

    if (dto.role === UserRole.ADMIN) {
      const otherAdmin = await this.prisma.user.findFirst({
        where: {
          role: UserRole.ADMIN,
          id: { not: id },
        },
        select: { id: true },
      });

      if (otherAdmin) {
        throw new BadRequestException('Администратор в системе может быть только один');
      }
    }

    if (user.role === UserRole.ADMIN && dto.role && dto.role !== UserRole.ADMIN) {
      throw new BadRequestException('Нельзя снять роль с единственного администратора системы');
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        fullName: dto.fullName,
        email: dto.email,
        role: dto.role,
      },
      select: USER_SELECT,
    });
  }

  async toggleActive(id: string) {
    const user = await this.findById(id);

    if (user.role === UserRole.ADMIN && user.isActive) {
      throw new BadRequestException('Нельзя заблокировать администратора системы');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
      select: USER_SELECT,
    });

    // Revoke all refresh tokens if deactivating
    if (!updated.isActive) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return updated;
  }

  async resetPassword(id: string, newPassword: string) {
    await this.findById(id);
    if (newPassword.length < 6) throw new BadRequestException('Пароль должен быть не менее 6 символов');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: 'Пароль успешно изменён' };
  }

  async updateMyProfile(
    userId: string,
    dto: {
      fullName?: string;
      position?: string;
      phone?: string;
      themePreference?: ThemePreference;
      password?: string;
    },
  ) {
    const updates: any = {};
    if (dto.fullName !== undefined) updates.fullName = dto.fullName.trim();
    if (dto.position !== undefined) updates.position = dto.position?.trim() || null;
    if (dto.phone !== undefined) updates.phone = dto.phone?.trim() || null;
    if (dto.themePreference !== undefined) updates.themePreference = dto.themePreference;
    if (dto.password) {
      if (dto.password.length < 6) throw new BadRequestException('Пароль должен быть не менее 6 символов');
      updates.passwordHash = await bcrypt.hash(dto.password, 12);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: updates,
      select: USER_SELECT,
    });
  }

  async hardDelete(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
      },
    });
    if (!user) throw new NotFoundException('Пользователь не найден');

    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException('Нельзя удалить администратора системы');
    }

    const fallbackAdmin = await this.prisma.user.findFirst({
      where: {
        role: UserRole.ADMIN,
        id: { not: id },
        isActive: true,
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!fallbackAdmin) {
      throw new BadRequestException(
        'Невозможно удалить пользователя, пока в системе нет другого активного администратора для переназначения связанных данных',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      const cards = await tx.card.findMany({
        where: {
          OR: [{ executorId: id }, { reviewerId: id }],
        },
        select: {
          id: true,
          executorId: true,
          reviewerId: true,
        },
      });

      for (const card of cards) {
        const reviewerAvailable =
          !!card.reviewerId && card.reviewerId !== id;
        const nextExecutorId =
          card.executorId === id
            ? reviewerAvailable
              ? card.reviewerId
              : fallbackAdmin.id
            : card.executorId;
        const nextReviewerId =
          card.reviewerId === id ? fallbackAdmin.id : card.reviewerId;

        await tx.card.update({
          where: { id: card.id },
          data: {
            executorId: nextExecutorId,
            reviewerId: nextReviewerId,
            lastChangedById:
              card.executorId === id || card.reviewerId === id
                ? fallbackAdmin.id
                : undefined,
          },
        });
      }

      await Promise.all([
        tx.card.updateMany({
          where: { createdById: id },
          data: { createdById: fallbackAdmin.id },
        }),
        tx.card.updateMany({
          where: { lastChangedById: id },
          data: { lastChangedById: fallbackAdmin.id },
        }),
        tx.dataSource.updateMany({
          where: { createdById: id },
          data: { createdById: fallbackAdmin.id },
        }),
        tx.sourceMaterial.updateMany({
          where: { uploadedById: id },
          data: { uploadedById: fallbackAdmin.id },
        }),
        tx.resultVersion.updateMany({
          where: { createdById: id },
          data: { createdById: fallbackAdmin.id },
        }),
        tx.reviewComment.updateMany({
          where: { authorId: id },
          data: { authorId: fallbackAdmin.id },
        }),
        tx.cardHistory.updateMany({
          where: { userId: id },
          data: { userId: null },
        }),
        tx.notification.updateMany({
          where: { actorId: id },
          data: { actorId: null },
        }),
        tx.pendingNotification.updateMany({
          where: { actorId: id },
          data: { actorId: null },
        }),
        tx.notificationEmailSettings.updateMany({
          where: { updatedById: id },
          data: { updatedById: fallbackAdmin.id },
        }),
        tx.adminRequest.updateMany({
          where: { createdById: id },
          data: { createdById: fallbackAdmin.id },
        }),
        tx.adminRequest.updateMany({
          where: { completedById: id },
          data: { completedById: fallbackAdmin.id },
        }),
        tx.adminRequest.updateMany({
          where: { rejectedById: id },
          data: { rejectedById: fallbackAdmin.id },
        }),
        tx.adminRequestMessage.updateMany({
          where: { authorId: id },
          data: { authorId: fallbackAdmin.id },
        }),
        tx.instructionFolder.updateMany({
          where: { createdById: id },
          data: { createdById: fallbackAdmin.id },
        }),
        tx.instruction.updateMany({
          where: { createdById: id },
          data: { createdById: fallbackAdmin.id },
        }),
        tx.instruction.updateMany({
          where: { updatedById: id },
          data: { updatedById: fallbackAdmin.id },
        }),
        tx.instructionAttachment.updateMany({
          where: { uploadedById: id },
          data: { uploadedById: fallbackAdmin.id },
        }),
        tx.cardInstruction.updateMany({
          where: { createdById: id },
          data: { createdById: fallbackAdmin.id },
        }),
        tx.dataSourceInstruction.updateMany({
          where: { createdById: id },
          data: { createdById: fallbackAdmin.id },
        }),
        tx.refreshToken.deleteMany({
          where: { userId: id },
        }),
        tx.cardWatcher.deleteMany({
          where: { userId: id },
        }),
      ]);

      await tx.user.delete({ where: { id } });
    });

    return { message: 'Пользователь удалён' };
  }
}
