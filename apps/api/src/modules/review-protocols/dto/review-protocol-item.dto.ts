import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ReviewProtocolItemDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
