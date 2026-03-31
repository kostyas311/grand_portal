import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminOnly } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationEmailSettingsService } from './notification-email-settings.service';
import { UpdateNotificationEmailSettingsDto } from './dto/update-notification-email-settings.dto';
import { TestNotificationEmailSettingsDto } from './dto/test-notification-email-settings.dto';

@ApiTags('notification-email-settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@AdminOnly()
@Controller('notification-email-settings')
export class NotificationEmailSettingsController {
  constructor(
    private readonly notificationEmailSettingsService: NotificationEmailSettingsService,
  ) {}

  @Get()
  getSettings() {
    return this.notificationEmailSettingsService.getAdminSettings();
  }

  @Patch()
  update(@Body() dto: UpdateNotificationEmailSettingsDto, @CurrentUser() user: any) {
    return this.notificationEmailSettingsService.update(dto, user.id);
  }

  @Post('test')
  testConnection(@Body() dto: TestNotificationEmailSettingsDto) {
    return this.notificationEmailSettingsService.testConnection(dto);
  }
}
