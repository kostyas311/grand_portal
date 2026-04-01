import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectAdminRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Комментарий слишком длинный' })
  rejectionComment?: string;
}
