import {
  IsBoolean, IsEnum, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, Min, MaxLength, MinLength, ValidateIf,
} from 'class-validator';
import { CardPriority } from '@prisma/client';
import { Type, Transform } from 'class-transformer';

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

  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month: number;

  @IsInt()
  @Min(2000)
  @Max(2100)
  @Type(() => Number)
  year: number;

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
  @ValidateIf(o => o.executorId !== '' && o.executorId != null)
  @IsUUID()
  @Transform(({ value }) => value === '' ? undefined : value)
  executorId?: string;

  @IsOptional()
  @ValidateIf(o => o.reviewerId !== '' && o.reviewerId != null)
  @IsUUID()
  @Transform(({ value }) => value === '' ? undefined : value)
  reviewerId?: string;

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
