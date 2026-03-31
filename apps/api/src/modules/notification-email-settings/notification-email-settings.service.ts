import { BadRequestException, Injectable } from '@nestjs/common';
import { NotificationEmailSettings } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateNotificationEmailSettingsDto } from './dto/update-notification-email-settings.dto';
import { TestNotificationEmailSettingsDto } from './dto/test-notification-email-settings.dto';

const DEFAULT_SETTINGS_ID = 'default';

export type NotificationEmailDeliverySettings = Pick<
  NotificationEmailSettings,
  'isEnabled' | 'host' | 'port' | 'secure' | 'username' | 'password' | 'fromEmail' | 'fromName' | 'replyTo'
>;

@Injectable()
export class NotificationEmailSettingsService {
  constructor(private prisma: PrismaService) {}

  async getAdminSettings() {
    const settings = await this.prisma.notificationEmailSettings.findUnique({
      where: { id: DEFAULT_SETTINGS_ID },
      include: {
        updatedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    return this.mapForAdmin(settings);
  }

  async update(dto: UpdateNotificationEmailSettingsDto, adminId: string) {
    this.validate(dto);

    const settings = await this.prisma.notificationEmailSettings.findUnique({
      where: { id: DEFAULT_SETTINGS_ID },
    });

    const nextPassword = dto.password !== undefined ? dto.password : settings?.password;

    const saved = await this.prisma.notificationEmailSettings.upsert({
      where: { id: DEFAULT_SETTINGS_ID },
      create: {
        id: DEFAULT_SETTINGS_ID,
        isEnabled: dto.isEnabled,
        host: dto.host,
        port: dto.port,
        secure: dto.secure,
        username: dto.username,
        password: nextPassword,
        fromEmail: dto.fromEmail,
        fromName: dto.fromName,
        replyTo: dto.replyTo,
        updatedById: adminId,
      },
      update: {
        isEnabled: dto.isEnabled,
        host: dto.host,
        port: dto.port,
        secure: dto.secure,
        username: dto.username,
        password: nextPassword,
        fromEmail: dto.fromEmail,
        fromName: dto.fromName,
        replyTo: dto.replyTo,
        updatedById: adminId,
      },
      include: {
        updatedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    return this.mapForAdmin(saved);
  }

  async testConnection(dto: TestNotificationEmailSettingsDto) {
    const current = await this.prisma.notificationEmailSettings.findUnique({
      where: { id: DEFAULT_SETTINGS_ID },
    });

    const host = dto.host ?? current?.host;
    const port = dto.port ?? current?.port;
    const username = dto.username ?? current?.username;
    const password = dto.password !== undefined ? dto.password : current?.password;

    if (!host || !port) {
      throw new BadRequestException(
        'Для теста соединения укажите SMTP-сервер и порт',
      );
    }

    const transporter = nodemailer.createTransport(
      this.buildTransportOptions({
        host,
        port,
        secure: dto.secure,
        username,
        password,
      }),
    );

    try {
      await transporter.verify();
    } catch (error: any) {
      throw new BadRequestException(this.mapTestConnectionError(error, dto.secure, port));
    }

    return {
      success: true,
      message: 'Соединение с почтовым сервером успешно установлено',
    };
  }

  async getDeliverySettings(): Promise<NotificationEmailDeliverySettings | null> {
    const settings = await this.prisma.notificationEmailSettings.findUnique({
      where: { id: DEFAULT_SETTINGS_ID },
    });

    if (!settings?.isEnabled || !settings.host || !settings.port || !settings.fromEmail) {
      return null;
    }

    return settings;
  }

  private validate(dto: UpdateNotificationEmailSettingsDto) {
    if (!dto.isEnabled) {
      return;
    }

    if (!dto.host || !dto.port || !dto.fromEmail) {
      throw new BadRequestException(
        'Для включения email-рассылки заполните SMTP-сервер, порт и email отправителя',
      );
    }
  }

  private buildTransportOptions(params: {
    host: string;
    port: number;
    secure: boolean;
    username?: string;
    password?: string;
  }): SMTPTransport.Options {
    const useImplicitTls = params.secure && params.port === 465;
    const useStartTls = params.secure && params.port !== 465;

    return {
      host: params.host,
      port: params.port,
      secure: useImplicitTls,
      requireTLS: useStartTls,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      name: 'localhost',
      tls: {
        servername: params.host,
      },
      auth:
        params.username && params.password
          ? {
              user: params.username,
              pass: params.password,
            }
          : undefined,
    };
  }

  private mapTestConnectionError(error: unknown, secure: boolean, port: number) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Не удалось установить соединение с почтовым сервером';

    const normalized = message.toLowerCase();

    if (normalized.includes('wrong version number')) {
      return secure
        ? `Не удалось установить SMTP-соединение с шифрованием. Для порта ${port} проверьте режим TLS: обычно 465 работает как SSL/TLS, а 587 или 25 используют STARTTLS после обычного подключения.`
        : `Почтовый сервер ожидает другой режим шифрования. Для порта ${port} обычно используют TLS/STARTTLS, если этого требует ваш провайдер.`;
    }

    if (normalized.includes('client network socket disconnected before secure tls connection was established')) {
      return `SMTP-сервер разорвал соединение до завершения TLS-рукопожатия. Обычно это связано с несовместимым режимом шифрования, блокировкой соединения или сетевыми ограничениями. Для ${port} проверьте, что сервер доступен из Docker-контейнера, а логин указан в формате, который ожидает провайдер. Для Яндекса обычно лучше использовать полный email как логин.`;
    }

    if (normalized.includes('self-signed certificate')) {
      return 'Почтовый сервер вернул недоверенный сертификат. Проверьте SSL/TLS-сертификат на стороне SMTP-сервера.';
    }

    if (normalized.includes('certificate')) {
      return 'Не удалось проверить сертификат SMTP-сервера. Проверьте настройки SSL/TLS и сертификат сервера.';
    }

    if (normalized.includes('econnrefused')) {
      return `Не удалось подключиться к SMTP-серверу на порту ${port}. Проверьте адрес сервера, порт и доступность соединения.`;
    }

    if (normalized.includes('etimedout') || normalized.includes('timeout')) {
      return 'Истекло время ожидания ответа от SMTP-сервера. Проверьте адрес, порт и сетевую доступность сервера.';
    }

    if (
      normalized.includes('invalid login') ||
      normalized.includes('authentication') ||
      normalized.includes('auth') ||
      normalized.includes('535')
    ) {
      return 'SMTP-сервер отклонил авторизацию. Проверьте логин, пароль и требования сервера к способу входа.';
    }

    return message || 'Не удалось установить соединение с почтовым сервером';
  }

  private mapForAdmin(settings: (NotificationEmailSettings & { updatedBy?: any }) | null) {
    return {
      isEnabled: settings?.isEnabled ?? false,
      host: settings?.host ?? '',
      port: settings?.port ?? 587,
      secure: settings?.secure ?? false,
      username: settings?.username ?? '',
      fromEmail: settings?.fromEmail ?? '',
      fromName: settings?.fromName ?? '',
      replyTo: settings?.replyTo ?? '',
      hasPassword: Boolean(settings?.password),
      updatedAt: settings?.updatedAt ?? null,
      updatedBy: settings?.updatedBy ?? null,
    };
  }
}
