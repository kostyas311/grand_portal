import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';
import { MaterialType } from '@prisma/client';

export class AddMaterialDto {
  @IsEnum(MaterialType)
  materialType: MaterialType;

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
