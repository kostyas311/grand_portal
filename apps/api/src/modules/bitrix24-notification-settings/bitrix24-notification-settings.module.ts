import { Module } from '@nestjs/common';
import { Bitrix24NotificationSettingsController } from './bitrix24-notification-settings.controller';
import { Bitrix24NotificationSettingsService } from './bitrix24-notification-settings.service';

@Module({
  controllers: [Bitrix24NotificationSettingsController],
  providers: [Bitrix24NotificationSettingsService],
  exports: [Bitrix24NotificationSettingsService],
})
export class Bitrix24NotificationSettingsModule {}
