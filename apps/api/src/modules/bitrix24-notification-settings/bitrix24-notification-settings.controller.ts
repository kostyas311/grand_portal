import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminOnly } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Bitrix24NotificationSettingsService } from './bitrix24-notification-settings.service';
import { UpdateBitrix24NotificationSettingsDto } from './dto/update-bitrix24-notification-settings.dto';
import { TestBitrix24NotificationSettingsDto } from './dto/test-bitrix24-notification-settings.dto';

@ApiTags('bitrix24-notification-settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@AdminOnly()
@Controller('bitrix24-notification-settings')
export class Bitrix24NotificationSettingsController {
  constructor(
    private readonly bitrix24NotificationSettingsService: Bitrix24NotificationSettingsService,
  ) {}

  @Get()
  getSettings() {
    return this.bitrix24NotificationSettingsService.getAdminSettings();
  }

  @Patch()
  update(@Body() dto: UpdateBitrix24NotificationSettingsDto, @CurrentUser() user: any) {
    return this.bitrix24NotificationSettingsService.update(dto, user.id);
  }

  @Post('test')
  testConnection(@Body() dto: TestBitrix24NotificationSettingsDto) {
    return this.bitrix24NotificationSettingsService.testConnection(dto);
  }
}
