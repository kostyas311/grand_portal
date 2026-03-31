import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateBitrix24NotificationSettingsDto {
  @ApiPropertyOptional()
  @IsBoolean()
  isEnabled: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(
    { require_tld: false },
    { message: 'Укажите корректный URL входящего webhook Bitrix24' },
  )
  webhookUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  messagePrefix?: string;
}
