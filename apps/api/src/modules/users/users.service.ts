import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  isActive: true,
  position: true,
  phone: true,
  bitrix24UserId: true,
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

    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        passwordHash,
        role: dto.role,
        bitrix24UserId: dto.bitrix24UserId?.trim() || null,
        isActive: true,
      },
      select: USER_SELECT,
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findById(id);

    if (dto.email) {
      const existing = await this.prisma.user.findFirst({
        where: { email: dto.email, id: { not: id } },
      });
      if (existing) throw new ConflictException('Email уже используется');
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        fullName: dto.fullName,
        email: dto.email,
        role: dto.role,
        bitrix24UserId:
          dto.bitrix24UserId !== undefined ? dto.bitrix24UserId.trim() || null : undefined,
      },
      select: USER_SELECT,
    });
  }

  async toggleActive(id: string) {
    const user = await this.findById(id);
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

  async updateMyProfile(userId: string, dto: { fullName?: string; position?: string; phone?: string; password?: string }) {
    const updates: any = {};
    if (dto.fullName !== undefined) updates.fullName = dto.fullName.trim();
    if (dto.position !== undefined) updates.position = dto.position?.trim() || null;
    if (dto.phone !== undefined) updates.phone = dto.phone?.trim() || null;
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
    await this.findById(id);
    await this.prisma.user.delete({ where: { id } });
    return { message: 'Пользователь удалён' };
  }
}
