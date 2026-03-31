import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { AdminRequestStatus } from '@prisma/client';

export class AdminRequestsFilterDto {
  @IsOptional()
  @IsEnum(AdminRequestStatus)
  status?: AdminRequestStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}
