import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateDataSourceDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  website?: string;
}
