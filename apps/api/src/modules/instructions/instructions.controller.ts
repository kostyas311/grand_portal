import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateInstructionDto } from './dto/create-instruction.dto';
import { ListInstructionsDto } from './dto/list-instructions.dto';
import { UpdateInstructionDto } from './dto/update-instruction.dto';
import { InstructionsService } from './instructions.service';
import { createDiskUploadOptions } from '../../common/utils/upload.util';

@ApiTags('instructions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class InstructionsController {
  constructor(private readonly service: InstructionsService) {}

  @Get('instruction-folders')
  listFolders() {
    return this.service.listFolders();
  }

  @Get('instructions')
  findAll(@Query() query: ListInstructionsDto, @CurrentUser() user: any) {
    return this.service.findAll(query, user.id, user.role as UserRole);
  }

  @Get('instructions/published')
  findPublished() {
    return this.service.findPublished();
  }

  @Get('instructions/:id')
  findById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findById(id, user.id, user.role as UserRole);
  }

  @Post('instructions')
  create(@Body() dto: CreateInstructionDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.id);
  }

  @Patch('instructions/:id')
  update(@Param('id') id: string, @Body() dto: UpdateInstructionDto, @CurrentUser() user: any) {
    return this.service.update(id, dto, user.id, user.role as UserRole);
  }

  @Delete('instructions/:id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user.id, user.role as UserRole);
  }

  @Post('instructions/:id/attachments')
  @UseInterceptors(FilesInterceptor('files', 10, createDiskUploadOptions(10 * 1024 * 1024, 10)))
  uploadAttachments(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.service.uploadAttachments(id, user.id, user.role as UserRole, files);
  }

  @Delete('instructions/:id/attachments/:attachmentId')
  deleteAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.deleteAttachment(id, attachmentId, user.id, user.role as UserRole);
  }

  @Get('instructions/:id/attachments/:attachmentId/download')
  downloadAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    return this.service.downloadAttachment(id, attachmentId, user.id, user.role as UserRole, res);
  }

  @Get('cards/:cardId/instructions')
  getCardInstructions(@Param('cardId') cardId: string, @CurrentUser() user: any) {
    return this.service.getCardInstructions(cardId, user.id, user.role as UserRole);
  }

  @Post('cards/:cardId/instructions/:instructionId')
  attachToCard(
    @Param('cardId') cardId: string,
    @Param('instructionId') instructionId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.attachToCard(cardId, instructionId, user.id, user.role as UserRole);
  }

  @Delete('cards/:cardId/instructions/:instructionId')
  detachFromCard(
    @Param('cardId') cardId: string,
    @Param('instructionId') instructionId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.detachFromCard(cardId, instructionId, user.id, user.role as UserRole);
  }
}
