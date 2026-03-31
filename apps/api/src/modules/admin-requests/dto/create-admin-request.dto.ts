import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class CreateAdminRequestDto {
  @MinLength(10, { message: 'Опишите обращение подробнее, не менее 10 символов' })
  @MaxLength(5000, { message: 'Текст обращения слишком длинный' })
  @IsString()
  description: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUrl({ require_tld: false }, { each: true, message: 'Все ссылки должны быть корректными URL' })
  links?: string[];
}
