import {
  IsBoolean, IsEnum, IsISO8601, IsOptional, IsString, IsUUID, MaxLength,
} from 'class-validator';
import { CardPriority } from '@prisma/client';
import { Transform } from 'class-transformer';

const toBool = ({ value }: { value: any }) => value === true || value === 'true';

export class UpdateCardDto {
  @IsOptional()
  @IsUUID()
  dataSourceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  extraTitle?: string;

  @IsOptional()
  @IsUUID()
  sprintId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(CardPriority)
  priority?: CardPriority;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  withoutResult?: boolean;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  withoutSourceMaterials?: boolean;
}
