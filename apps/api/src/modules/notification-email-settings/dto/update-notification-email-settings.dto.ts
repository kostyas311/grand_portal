import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

const trimOrUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export class UpdateNotificationEmailSettingsDto {
  @IsBoolean()
  isEnabled: boolean;

  @IsOptional()
  @Transform(trimOrUndefined)
  @IsString()
  host?: string;

  @Transform(({ value }) => (value === '' || value === null || value === undefined ? undefined : Number(value)))
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsBoolean()
  secure: boolean;

  @IsOptional()
  @Transform(trimOrUndefined)
  @IsString()
  username?: string;

  @IsOptional()
  @Transform(trimOrUndefined)
  @IsString()
  password?: string;

  @IsOptional()
  @Transform(trimOrUndefined)
  @IsEmail({}, { message: 'Укажите корректный email отправителя' })
  fromEmail?: string;

  @IsOptional()
  @Transform(trimOrUndefined)
  @IsString()
  fromName?: string;

  @IsOptional()
  @Transform(trimOrUndefined)
  @IsEmail({}, { message: 'Укажите корректный email для Reply-To' })
  replyTo?: string;
}
