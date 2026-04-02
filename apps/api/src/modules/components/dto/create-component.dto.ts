import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateComponentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  location: string;
}
