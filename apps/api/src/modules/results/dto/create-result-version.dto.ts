import { IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateResultVersionDto {
  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return []; }
    }
    return value ?? [];
  })
  links?: Array<{ url: string; title?: string; description?: string }>;
}
