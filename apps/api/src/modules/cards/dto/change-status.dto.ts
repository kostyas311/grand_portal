import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { CardStatus } from '@prisma/client';

export class ChangeStatusDto {
  @IsEnum(CardStatus)
  status: CardStatus;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  force?: boolean;
}
