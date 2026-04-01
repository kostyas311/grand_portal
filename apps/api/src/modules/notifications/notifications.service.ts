import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsFilterDto } from './dto/notifications-filter.dto';
import { NotificationEmailSettingsService } from '../notification-email-settings/notification-email-settings.service';

type CreateCardNotificationParams = {
  type: NotificationType;
  title: string;
  message: string;
  actorId?: string;
  includeWatchers?: boolean;
  extraUserIds?: Array<string | null | undefined>;
  excludeUserIds?: Array<string | null | undefined>;
};

type CreateAdminRequestNotificationParams = {
  type: NotificationType;
  title: string;
  message: string;
  actorId?: string;
  recipientUserIds: Array<string | null | undefined>;
  excludeUserIds?: Array<string | null | undefined>;
};

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly portalBaseUrl =
    process.env.PORTAL_BASE_URL || process.env.APP_BASE_URL || 'http://localhost';
  private flushTimer?: NodeJS.Timeout;
  private isFlushing = false;

  constructor(
    private prisma: PrismaService,
    private notificationEmailSettingsService: NotificationEmailSettingsService,
  ) {}

  onModuleInit() {
    this.flushTimer = setInterval(() => {
      void this.flushPendingNotifications();
    }, 3 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
  }

  async findAll(filter: NotificationsFilterDto, userId: string) {
    const page = filter.page || 1;
    const limit = Math.min(filter.limit || 20, 100);
    const skip = (page - 1) * limit;
    const visibleReadSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const where = {
      userId,
      ...(filter.unreadOnly
        ? { isRead: false }
        : {
            OR: [
              { isRead: false },
              {
                isRead: true,
                readAt: { gte: visibleReadSince },
              },
              {
                isRead: true,
                readAt: null,
                createdAt: { gte: visibleReadSince },
              },
            ],
          }),
    };

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        include: {
          card: {
            select: {
              id: true,
              publicId: true,
              extraTitle: true,
              status: true,
              sprint: {
                select: {
                  id: true,
                  name: true,
                },
              },
              dataSource: { select: { name: true } },
            },
          },
          adminRequest: {
            select: {
              id: true,
              publicId: true,
              status: true,
              description: true,
              createdBy: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
            },
          },
          actor: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return {
      items,
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUnreadCount(userId: string) {
    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    return { unreadCount };
  }

  async markAsRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException('Уведомление не найдено');
    }

    if (notification.isRead) {
      return notification;
    }

    return this.prisma.notification.update({
      where: { id: notification.id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { updated: result.count };
  }

  async createForCardEvent(cardId: string, params: CreateCardNotificationParams) {
    const card = await this.prisma.card.findFirst({
      where: {
        OR: [{ id: cardId }, { publicId: cardId }],
      },
      select: {
        id: true,
        watchers: {
          select: {
            userId: true,
            source: true,
          },
        },
      },
    });

    if (!card) {
      return { created: 0 };
    }

    const recipients = new Set<string>();

    if (params.includeWatchers !== false) {
      for (const watcher of card.watchers) {
        recipients.add(watcher.userId);
      }
    }

    for (const userId of params.extraUserIds || []) {
      if (userId) {
        recipients.add(userId);
      }
    }

    for (const userId of params.excludeUserIds || []) {
      if (userId) {
        recipients.delete(userId);
      }
    }

    if (recipients.size === 0) {
      return { created: 0 };
    }

    await this.prisma.pendingNotification.createMany({
      data: Array.from(recipients).map((userId) => ({
        userId,
        cardId: card.id,
        adminRequestId: null,
        actorId: params.actorId,
        type: params.type,
        title: params.title,
        message: params.message,
      })),
    });

    return { created: recipients.size };
  }

  async createForAdminRequestEvent(
    adminRequestId: string,
    params: CreateAdminRequestNotificationParams,
  ) {
    const adminRequest = await this.prisma.adminRequest.findFirst({
      where: {
        OR: [{ id: adminRequestId }, { publicId: adminRequestId }],
      },
      select: { id: true },
    });

    if (!adminRequest) {
      return { created: 0 };
    }

    const recipients = new Set<string>();

    for (const userId of params.recipientUserIds || []) {
      if (userId) {
        recipients.add(userId);
      }
    }

    for (const userId of params.excludeUserIds || []) {
      if (userId) {
        recipients.delete(userId);
      }
    }

    if (recipients.size === 0) {
      return { created: 0 };
    }

    await this.prisma.pendingNotification.createMany({
      data: Array.from(recipients).map((userId) => ({
        userId,
        cardId: null,
        adminRequestId: adminRequest.id,
        actorId: params.actorId,
        type: params.type,
        title: params.title,
        message: params.message,
      })),
    });

    return { created: recipients.size };
  }

  private async flushPendingNotifications() {
    if (this.isFlushing) {
      return;
    }

    this.isFlushing = true;

    try {
      const pendingItems = await this.prisma.pendingNotification.findMany({
        orderBy: { createdAt: 'asc' },
      });

      if (pendingItems.length === 0) {
        return;
      }

      const groups = new Map<string, typeof pendingItems>();

      for (const item of pendingItems) {
        const key = [
          item.userId,
          item.type,
          item.cardId || '',
          item.adminRequestId || '',
          item.type === NotificationType.COMMENT_ADDED ? item.id : '',
        ].join(':');

        const existing = groups.get(key) || [];
        existing.push(item);
        groups.set(key, existing);
      }

      const notifications = Array.from(groups.values()).map((items) => {
        const first = items[0];
        const actorIds = Array.from(new Set(items.map((item) => item.actorId).filter(Boolean)));
        const actorId = actorIds.length === 1 ? actorIds[0]! : null;
        const aggregated = this.buildAggregatedNotification(items);

        return {
          userId: first.userId,
          cardId: first.cardId,
          adminRequestId: first.adminRequestId,
          actorId,
          type: first.type,
          title: aggregated.title,
          message: aggregated.message,
        };
      });

      await this.prisma.$transaction([
        this.prisma.notification.createMany({ data: notifications }),
        this.prisma.pendingNotification.deleteMany({
          where: {
            id: { in: pendingItems.map((item) => item.id) },
          },
        }),
      ]);

      await this.sendEmailNotifications(pendingItems);
    } catch (error: any) {
      this.logger.error(
        'Не удалось отправить накопленные уведомления',
        error?.stack || String(error),
      );
    } finally {
      this.isFlushing = false;
    }
  }

  private buildAggregatedNotification(
    items: Array<{
      type: NotificationType;
      title: string;
      message: string;
      cardId: string | null;
      adminRequestId: string | null;
    }>,
  ) {
    if (items.length === 1) {
      return {
        title: items[0].title,
        message: items[0].message,
      };
    }

    const first = items[0];
    const count = items.length;

    if (first.adminRequestId) {
      return {
        title: this.getAdminRequestBatchTitle(first.type, count),
        message: `За последние 3 минуты накопилось ${count} обновлений по обращению.`,
      };
    }

    return {
      title: this.getCardBatchTitle(first.type, count),
      message: `За последние 3 минуты накопилось ${count} обновлений по карточке.`,
    };
  }

  private getCardBatchTitle(type: NotificationType, count: number) {
    switch (type) {
      case NotificationType.COMMENT_ADDED:
        return `Новые комментарии (${count})`;
      case NotificationType.SOURCE_MATERIAL_ADDED:
        return `Новые исходные данные (${count})`;
      case NotificationType.RESULT_ADDED:
        return `Новые результаты (${count})`;
      case NotificationType.CARD_UPDATED:
        return `Обновлены данные карточки (${count})`;
      case NotificationType.REVIEW_REQUEST:
        return `Новые события проверки (${count})`;
      case NotificationType.ASSIGNMENT_CHANGED:
        return `Обновлены назначения (${count})`;
      default:
        return `Новые события по карточке (${count})`;
    }
  }

  private getAdminRequestBatchTitle(type: NotificationType, count: number) {
    switch (type) {
      case NotificationType.ADMIN_REQUEST_CREATED:
        return `Новые обращения (${count})`;
      case NotificationType.ADMIN_REQUEST_NEEDS_INFO:
        return `Обращения требуют уточнения (${count})`;
      case NotificationType.ADMIN_REQUEST_REPLIED:
        return `Поступили уточнения (${count})`;
      case NotificationType.ADMIN_REQUEST_COMPLETED:
        return `Обращения выполнены (${count})`;
      case NotificationType.ADMIN_REQUEST_REJECTED:
        return `Обращения отклонены (${count})`;
      default:
        return `Новые события по обращениям (${count})`;
    }
  }

  private async sendEmailNotifications(
    notifications: Array<{
      userId: string;
      cardId: string | null;
      adminRequestId: string | null;
      actorId: string | null;
      type: NotificationType;
      title: string;
      message: string;
      createdAt: Date;
    }>,
  ) {
    const settings = await this.notificationEmailSettingsService.getDeliverySettings();

    if (!settings) {
      return;
    }

    const userIds = Array.from(new Set(notifications.map((item) => item.userId)));
    const cardIds = Array.from(
      new Set(notifications.map((item) => item.cardId).filter((value): value is string => Boolean(value))),
    );
    const adminRequestIds = Array.from(
      new Set(
        notifications
          .map((item) => item.adminRequestId)
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const actorIds = Array.from(
      new Set(notifications.map((item) => item.actorId).filter((value): value is string => Boolean(value))),
    );

    const [users, cards, adminRequests, actors] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          id: { in: userIds },
          isActive: true,
        },
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      }),
      cardIds.length
        ? this.prisma.card.findMany({
            where: {
              id: { in: cardIds },
            },
            select: {
              id: true,
              publicId: true,
              createdById: true,
              executorId: true,
              reviewerId: true,
              extraTitle: true,
              dataSource: { select: { name: true } },
              watchers: {
                select: {
                  userId: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      adminRequestIds.length
        ? this.prisma.adminRequest.findMany({
            where: {
              id: { in: adminRequestIds },
            },
            select: {
              id: true,
              publicId: true,
              description: true,
            },
          })
        : Promise.resolve([]),
      actorIds.length
        ? this.prisma.user.findMany({
            where: {
              id: { in: actorIds },
            },
            select: {
              id: true,
              fullName: true,
            },
          })
        : Promise.resolve([]),
    ]);

    if (users.length === 0) {
      return;
    }

    const usersById = new Map(users.map((user) => [user.id, user]));
    const cardsById = new Map(cards.map((card) => [card.id, card]));
    const adminRequestsById = new Map(adminRequests.map((item) => [item.id, item]));
    const actorsById = new Map(actors.map((actor) => [actor.id, actor]));
    const grouped = new Map<
      string,
      Array<{
        title: string;
        message: string;
        actorName?: string;
        createdAt: Date;
        targetLabel?: string;
        targetUrl?: string;
      }>
    >();

    for (const notification of notifications) {
      const recipient = usersById.get(notification.userId);
      if (!recipient) {
        continue;
      }

      if (notification.cardId) {
        const card = cardsById.get(notification.cardId);
        if (!card) {
          continue;
        }

        const isWatcher = card.watchers.some((watcher) => watcher.userId === notification.userId);
        const isCreator = card.createdById === notification.userId;
        const isExecutor = card.executorId === notification.userId;
        const isReviewer = card.reviewerId === notification.userId;
        const isReviewerForReview =
          notification.type === NotificationType.REVIEW_REQUEST &&
          card.reviewerId === notification.userId;

        if (!isWatcher && !isCreator && !isExecutor && !isReviewer && !isReviewerForReview) {
          continue;
        }

        const targetLabel = card.dataSource?.name
          ? card.extraTitle
            ? `${card.dataSource.name} — ${card.extraTitle}`
            : card.dataSource.name
          : card.publicId;

        const existing = grouped.get(notification.userId) || [];
        existing.push({
          title: notification.title,
          message: notification.message,
          actorName: notification.actorId ? actorsById.get(notification.actorId)?.fullName : undefined,
          createdAt: notification.createdAt,
          targetLabel,
          targetUrl: `${this.portalBaseUrl}/cards/${card.publicId}`,
        });
        grouped.set(notification.userId, existing);
        continue;
      }

      if (notification.adminRequestId) {
        const adminRequest = adminRequestsById.get(notification.adminRequestId);
        const existing = grouped.get(notification.userId) || [];
        existing.push({
          title: notification.title,
          message: notification.message,
          actorName: notification.actorId ? actorsById.get(notification.actorId)?.fullName : undefined,
          createdAt: notification.createdAt,
          targetLabel: adminRequest?.publicId || 'Обращения к администратору',
          targetUrl: `${this.portalBaseUrl}/requests`,
        });
        grouped.set(notification.userId, existing);
      }
    }

    if (grouped.size === 0) {
      return;
    }

    const transporter = nodemailer.createTransport(
      this.buildTransportOptions({
        host: settings.host,
        port: settings.port,
        secure: settings.secure,
        username: settings.username || undefined,
        password: settings.password || undefined,
      }),
    );

    for (const [userId, items] of grouped.entries()) {
      const recipient = usersById.get(userId);
      if (!recipient || items.length === 0) {
        continue;
      }

      const sortedItems = [...items].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );

      try {
        await transporter.sendMail({
          from: settings.fromName
            ? `"${settings.fromName}" <${settings.fromEmail}>`
            : settings.fromEmail,
          to: recipient.email,
          replyTo: settings.replyTo || undefined,
          subject: this.buildEmailSubject(sortedItems),
          text: this.buildEmailText(recipient.fullName, sortedItems),
          html: this.buildEmailHtml(recipient.fullName, sortedItems),
        });
      } catch (error: any) {
        this.logger.error(
          `Не удалось отправить email-уведомление пользователю ${recipient.email}`,
          error?.stack || String(error),
        );
      }
    }
  }

  private buildEmailSubject(
    items: Array<{
      title: string;
      targetLabel?: string;
    }>,
  ) {
    if (items.length === 1) {
      return `NormBase Portal: ${items[0].title}`;
    }

    return `NormBase Portal: ${items.length} обновления`;
  }

  private buildEmailText(
    recipientName: string,
    items: Array<{
      title: string;
      message: string;
      actorName?: string;
      targetLabel?: string;
      targetUrl?: string;
    }>,
  ) {
    const lines = items.map(
      (item, index) =>
        [
          `${index + 1}. ${item.title}`,
          item.targetLabel ? `Объект: ${item.targetLabel}` : null,
          item.actorName ? `Инициатор: ${item.actorName}` : null,
          item.message,
          item.targetUrl ? `Ссылка: ${item.targetUrl}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
    );

    return [
      `Здравствуйте, ${recipientName}.`,
      '',
      items.length === 1
        ? 'В системе зафиксировано новое изменение:'
        : `В системе зафиксированы ${items.length} изменения:`,
      '',
      ...lines,
    ].join('\n');
  }

  private buildEmailHtml(
    recipientName: string,
    items: Array<{
      title: string;
      message: string;
      actorName?: string;
      targetLabel?: string;
      targetUrl?: string;
    }>,
  ) {
    const greeting = this.escapeHtml(recipientName);
    const list = items
      .map(
        (item) => `
          <div style="padding:18px;border:1px solid #dbe6f3;border-radius:18px;background:#ffffff;margin-bottom:14px;box-shadow:0 10px 24px rgba(16,43,77,0.05);">
            <div style="font-size:16px;font-weight:700;color:#15304f;margin-bottom:8px;">${this.escapeHtml(item.title)}</div>
            ${
              item.targetLabel
                ? `<div style="font-size:13px;color:#2f6de1;font-weight:700;margin-bottom:8px;">${this.escapeHtml(item.targetLabel)}</div>`
                : ''
            }
            ${
              item.actorName
                ? `<div style="font-size:12px;color:#8a9bb0;margin-bottom:8px;">Инициатор: ${this.escapeHtml(item.actorName)}</div>`
                : ''
            }
            <div style="font-size:14px;line-height:1.7;color:#607289;">${this.escapeHtml(item.message)}</div>
            ${
              item.targetUrl
                ? `<div style="margin-top:14px;"><a href="${this.escapeHtml(item.targetUrl)}" style="display:inline-block;padding:10px 14px;border-radius:999px;background:#2f6de1;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;">Открыть</a></div>`
                : ''
            }
          </div>
        `,
      )
      .join('');

    return `
      <div style="margin:0;padding:24px;background:#f4f7fb;font-family:Segoe UI,Arial,sans-serif;color:#15304f;">
        <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:28px;padding:30px;border:1px solid #e2eaf3;">
          <div style="font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#2f6de1;margin-bottom:12px;">
            NormBase Portal
          </div>
          <h1 style="margin:0 0 12px;font-size:28px;line-height:1.15;">${items.length === 1 ? 'Новое изменение в системе' : `${items.length} новых изменений`}</h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#607289;">
            Здравствуйте, ${greeting}. Ниже собрана только новая информация, которая изменилась в системе за последний интервал уведомлений.
          </p>
          ${list}
        </div>
      </div>
    `;
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
}
