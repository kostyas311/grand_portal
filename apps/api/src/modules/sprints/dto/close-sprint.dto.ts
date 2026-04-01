import { Transform } from 'class-transformer';
import { IsBoolean, IsISO8601, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

const toBool = ({ value }: { value: any }) => value === true || value === 'true';

export class CloseSprintDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nextSprintName?: string;

  @ValidateIf((o) => !!o.nextSprintName || !!o.nextSprintStartDate || !!o.nextSprintEndDate)
  @IsISO8601()
  nextSprintStartDate?: string;

  @ValidateIf((o) => !!o.nextSprintName || !!o.nextSprintStartDate || !!o.nextSprintEndDate)
  @IsISO8601()
  nextSprintEndDate?: string;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  transferOpenCards?: boolean;
}
