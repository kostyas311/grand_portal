import {
  IsEnum, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, Min, MaxLength,
} from 'class-validator';
import { CardPriority } from '@prisma/client';
import { Type } from 'class-transformer';

export class UpdateCardDto {
  @IsOptional()
  @IsUUID()
  dataSourceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  extraTitle?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month?: number;

  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  @Type(() => Number)
  year?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(CardPriority)
  priority?: CardPriority;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;
}
