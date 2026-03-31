import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CompleteAdminRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Комментарий слишком длинный' })
  completionComment?: string;
}
