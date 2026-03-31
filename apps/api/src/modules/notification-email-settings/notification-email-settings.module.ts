import { Module } from '@nestjs/common';
import { NotificationEmailSettingsController } from './notification-email-settings.controller';
import { NotificationEmailSettingsService } from './notification-email-settings.service';

@Module({
  controllers: [NotificationEmailSettingsController],
  providers: [NotificationEmailSettingsService],
  exports: [NotificationEmailSettingsService],
})
export class NotificationEmailSettingsModule {}
