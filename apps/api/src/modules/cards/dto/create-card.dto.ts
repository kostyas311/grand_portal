import {
  IsBoolean, IsEnum, IsISO8601, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf,
} from 'class-validator';
import { CardPriority } from '@prisma/client';
import { Transform } from 'class-transformer';

const toBool = ({ value }: { value: any }) => value === true || value === 'true';

export class CreateCardDto {
  @IsOptional()
  @ValidateIf(o => o.dataSourceId !== '' && o.dataSourceId != null)
  @IsUUID()
  @Transform(({ value }) => value === '' ? undefined : value)
  dataSourceId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  extraTitle: string;

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

  @IsUUID()
  executorId: string;

  @IsUUID()
  reviewerId: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  withoutResult?: boolean;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  withoutSourceMaterials?: boolean;
}
