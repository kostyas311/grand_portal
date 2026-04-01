import { IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateSprintDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;
}
