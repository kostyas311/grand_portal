import { IsOptional, IsUUID } from 'class-validator';

export class AssignDto {
  @IsOptional()
  @IsUUID()
  executorId?: string | null;

  @IsOptional()
  @IsUUID()
  reviewerId?: string | null;
}
