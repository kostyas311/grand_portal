import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InstructionStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateInstructionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @ApiProperty()
  @IsString()
  contentHtml: string;

  @ApiProperty({ enum: InstructionStatus })
  @IsEnum(InstructionStatus)
  status: InstructionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  folderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  newFolderName?: string;
}
