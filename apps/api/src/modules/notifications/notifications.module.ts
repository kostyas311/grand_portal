import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationEmailSettingsModule } from '../notification-email-settings/notification-email-settings.module';
import { Bitrix24NotificationSettingsModule } from '../bitrix24-notification-settings/bitrix24-notification-settings.module';

@Module({
  imports: [NotificationEmailSettingsModule, Bitrix24NotificationSettingsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
