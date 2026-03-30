import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Неверный email или пароль');
    if (!user.isActive) throw new ForbiddenException('Аккаунт заблокирован');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Неверный email или пароль');

    return user;
  }

  async login(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = uuidv4();
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    const expiresIn = this.config.get('JWT_REFRESH_EXPIRES', '7d');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt,
      },
    });

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return { accessToken, refreshToken };
  }

  async refresh(rawRefreshToken: string) {
    // Find all non-revoked refresh tokens and check hash
    const tokens = await this.prisma.refreshToken.findMany({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    });

    let validToken = null;
    for (const token of tokens) {
      const match = await bcrypt.compare(rawRefreshToken, token.tokenHash);
      if (match) { validToken = token; break; }
    }

    if (!validToken) throw new UnauthorizedException('Недействительный токен обновления');
    if (!validToken.user.isActive) throw new ForbiddenException('Аккаунт заблокирован');

    // Revoke old token
    await this.prisma.refreshToken.update({
      where: { id: validToken.id },
      data: { revokedAt: new Date() },
    });

    return this.login(validToken.user);
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getMe(userId: string) {
    return this.usersService.findById(userId);
  }
}
