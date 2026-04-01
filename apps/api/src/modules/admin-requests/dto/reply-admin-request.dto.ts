import { IsString, MaxLength, MinLength } from 'class-validator';

export class ReplyAdminRequestDto {
  @IsString()
  @MinLength(3, { message: 'Комментарий слишком короткий' })
  @MaxLength(2000, { message: 'Комментарий слишком длинный' })
  text: string;
}
