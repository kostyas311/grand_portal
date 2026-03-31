import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

const toBool = ({ value }: { value: any }) => value === true || value === 'true';

export class NotificationsFilterDto {
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  unreadOnly?: boolean;

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
