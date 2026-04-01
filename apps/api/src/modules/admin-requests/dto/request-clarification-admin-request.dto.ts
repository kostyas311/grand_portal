import { IsString, MaxLength, MinLength } from 'class-validator';

export class RequestClarificationAdminRequestDto {
  @IsString()
  @MinLength(3, { message: 'Укажите комментарий для уточнения' })
  @MaxLength(2000, { message: 'Комментарий слишком длинный' })
  clarificationComment: string;
}
