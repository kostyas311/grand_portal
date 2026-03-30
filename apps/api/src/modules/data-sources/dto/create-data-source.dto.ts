import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateDataSourceDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  website?: string;
}
