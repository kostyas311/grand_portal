import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsUUID()
  resultVersionId?: string;
}
