import { IsISO8601, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSprintDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsISO8601()
  startDate: string;

  @IsISO8601()
  endDate: string;
}
