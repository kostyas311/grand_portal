import { IsEnum, IsOptional, IsString } from 'class-validator';
import { MaterialType } from '@prisma/client';

export class AddResultItemDto {
  @IsEnum(MaterialType)
  itemType: MaterialType;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  externalUrl?: string;
}
