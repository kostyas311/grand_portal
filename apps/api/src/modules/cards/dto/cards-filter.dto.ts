import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { CardStatus, CardPriority } from '@prisma/client';
import { Transform, Type } from 'class-transformer';

// NestJS с enableImplicitConversion конвертирует "true"→true до @Transform,
// поэтому обрабатываем оба варианта: строку и уже сконвертированный boolean
const toBool = ({ value }: { value: any }) => value === true || value === 'true';

export class CardsFilterDto {
  @IsOptional()
  @IsEnum(CardStatus, { each: true })
  status?: CardStatus | CardStatus[];

  @IsOptional()
  @IsUUID()
  dataSourceId?: string;

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
  @IsEnum(CardPriority)
  priority?: CardPriority;

  @IsOptional()
  @IsString()
  dueFilter?: 'overdue' | 'today' | 'next7' | 'next30' | 'none';

  @IsOptional()
  @IsString()
  dueDateFrom?: string;

  @IsOptional()
  @IsString()
  dueDateTo?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  myCards?: boolean;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  assignedToMe?: boolean;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  createdByMe?: boolean;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isArchived?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}
