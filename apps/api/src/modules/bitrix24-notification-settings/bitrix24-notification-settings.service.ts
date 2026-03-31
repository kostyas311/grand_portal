import { BadRequestException, Injectable } from '@nestjs/common';
import { Bitrix24NotificationSettings } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateBitrix24NotificationSettingsDto } from './dto/update-bitrix24-notification-settings.dto';
import { TestBitrix24NotificationSettingsDto } from './dto/test-bitrix24-notification-settings.dto';

const DEFAULT_SETTINGS_ID = 'default';

export type Bitrix24NotificationDeliverySettings = Pick<
  Bitrix24NotificationSettings,
  'isEnabled' | 'webhookUrl' | 'messagePrefix'
>;

@Injectable()
export class Bitrix24NotificationSettingsService {
  constructor(private prisma: PrismaService) {}

  async getAdminSettings() {
    const settings = await this.prisma.bitrix24NotificationSettings.findUnique({
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

  async update(dto: UpdateBitrix24NotificationSettingsDto, adminId: string) {
    this.validate(dto);

    const saved = await this.prisma.bitrix24NotificationSettings.upsert({
      where: { id: DEFAULT_SETTINGS_ID },
      create: {
        id: DEFAULT_SETTINGS_ID,
        isEnabled: dto.isEnabled,
        webhookUrl: dto.webhookUrl?.trim() || null,
        messagePrefix: dto.messagePrefix?.trim() || 'Нормбаза',
        updatedById: adminId,
      },
      update: {
        isEnabled: dto.isEnabled,
        webhookUrl: dto.webhookUrl?.trim() || null,
        messagePrefix: dto.messagePrefix?.trim() || 'Нормбаза',
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

  async testConnection(dto: TestBitrix24NotificationSettingsDto) {
    const current = await this.prisma.bitrix24NotificationSettings.findUnique({
      where: { id: DEFAULT_SETTINGS_ID },
    });

    const webhookUrl = dto.webhookUrl ?? current?.webhookUrl;

    if (!webhookUrl) {
      throw new BadRequestException(
        'Для теста соединения укажите URL входящего webhook Bitrix24',
      );
    }

    try {
      const result = await this.callWebhookMethod(webhookUrl, 'profile');

      return {
        success: true,
        message: result?.result?.NAME
          ? `Соединение с Bitrix24 успешно установлено. Текущий пользователь webhook: ${result.result.NAME}`
          : 'Соединение с Bitrix24 успешно установлено',
      };
    } catch (error: any) {
      throw new BadRequestException(this.mapConnectionError(error));
    }
  }

  async getDeliverySettings(): Promise<Bitrix24NotificationDeliverySettings | null> {
    const settings = await this.prisma.bitrix24NotificationSettings.findUnique({
      where: { id: DEFAULT_SETTINGS_ID },
    });

    if (!settings?.isEnabled || !settings.webhookUrl) {
      return null;
    }

    return settings;
  }

  async sendCardNotification(params: {
    webhookUrl: string;
    bitrix24UserId: string;
    title: string;
    message: string;
    cardUrl?: string;
    messagePrefix?: string | null;
  }) {
    const text = this.buildMessageText(params);
    await this.callWebhookMethod(params.webhookUrl, 'im.notify.system.add', {
      USER_ID: params.bitrix24UserId,
      MESSAGE: text,
      TAG: `normbase|${params.bitrix24UserId}|${Date.now()}`,
    });
  }

  private validate(dto: UpdateBitrix24NotificationSettingsDto) {
    if (!dto.isEnabled) {
      return;
    }

    if (!dto.webhookUrl) {
      throw new BadRequestException(
        'Для включения интеграции укажите URL входящего webhook Bitrix24',
      );
    }
  }

  private async callWebhookMethod(
    rawWebhookUrl: string,
    method: string,
    params?: Record<string, string>,
  ) {
    const webhookUrl = this.buildMethodUrl(rawWebhookUrl, method);
    const body = new URLSearchParams();

    for (const [key, value] of Object.entries(params || {})) {
      if (value !== undefined && value !== null && value !== '') {
        body.append(key, value);
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: body.toString(),
        signal: controller.signal,
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error_description || `HTTP ${response.status}`);
      }

      if (payload?.error) {
        throw new Error(payload.error_description || payload.error);
      }

      return payload;
    } finally {
      clearTimeout(timer);
    }
  }

  private buildMethodUrl(rawWebhookUrl: string, method: string) {
    const normalized = rawWebhookUrl.trim().replace(/\?.*$/, '');
    const withoutMethod = normalized.replace(/\/[^/]+\.json$/i, '/');
    const withSlash = withoutMethod.endsWith('/') ? withoutMethod : `${withoutMethod}/`;
    return `${withSlash}${method}.json`;
  }

  private buildMessageText(params: {
    title: string;
    message: string;
    cardUrl?: string;
    messagePrefix?: string | null;
  }) {
    const parts = [
      params.messagePrefix?.trim() ? `[${params.messagePrefix.trim()}]` : '[Нормбаза]',
      params.title,
      params.message,
      params.cardUrl ? `Открыть карточку: ${params.cardUrl}` : null,
    ].filter(Boolean);

    return parts.join('\n');
  }

  private mapConnectionError(error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Не удалось установить соединение с Bitrix24';

    const normalized = message.toLowerCase();

    if (normalized.includes('failed to parse url') || normalized.includes('invalid url')) {
      return 'Укажите корректный URL входящего webhook Bitrix24';
    }

    if (normalized.includes('abort') || normalized.includes('timeout')) {
      return 'Bitrix24 не ответил за отведённое время. Проверьте URL webhook и сетевую доступность портала.';
    }

    if (normalized.includes('invalid request credentials') || normalized.includes('expired_auth')) {
      return 'Bitrix24 отклонил webhook. Проверьте корректность URL и токена входящего webhook.';
    }

    if (normalized.includes('method not found')) {
      return 'Bitrix24 не принял вызов API. Проверьте корректность входящего webhook и доступность REST API.';
    }

    return message || 'Не удалось установить соединение с Bitrix24';
  }

  private mapForAdmin(
    settings: (Bitrix24NotificationSettings & { updatedBy?: any }) | null,
  ) {
    return {
      isEnabled: settings?.isEnabled ?? false,
      webhookUrl: settings?.webhookUrl ?? '',
      messagePrefix: settings?.messagePrefix ?? 'Нормбаза',
      updatedAt: settings?.updatedAt ?? null,
      updatedBy: settings?.updatedBy ?? null,
    };
  }
}
