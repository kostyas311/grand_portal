import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUrl } from 'class-validator';

export class TestBitrix24NotificationSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(
    { require_tld: false },
    { message: 'Укажите корректный URL входящего webhook Bitrix24' },
  )
  webhookUrl?: string;
}
