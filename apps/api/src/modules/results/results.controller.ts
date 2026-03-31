import {
  Controller, Get, Post, Delete, Body, Param, Res, UseGuards, UseInterceptors, UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { UserRole } from '@prisma/client';
import { ResultsService } from './results.service';
import { CreateResultVersionDto } from './dto/create-result-version.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminOnly } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('results')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cards/:cardId/results')
export class ResultsController {
  constructor(private service: ResultsService) {}

  @Get()
  findVersions(@Param('cardId') cardId: string) {
    return this.service.findVersions(cardId);
  }

  @Post()
  @UseInterceptors(FilesInterceptor('files', 20, {
    storage: memoryStorage(),
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '524288000') },
  }))
  createVersion(
    @Param('cardId') cardId: string,
    @Body() dto: CreateResultVersionDto,
    @CurrentUser() user: any,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.service.createVersion(cardId, dto, user.id, user.role as UserRole, files);
  }

  @Get(':versionId/download-all')
  downloadAll(
    @Param('cardId') cardId: string,
    @Param('versionId') versionId: string,
    @Res() res: Response,
  ) {
    return this.service.downloadVersionAll(cardId, versionId, res);
  }

  @Get(':versionId/items/:itemId/download')
  downloadItem(
    @Param('cardId') cardId: string,
    @Param('versionId') versionId: string,
    @Param('itemId') itemId: string,
    @Res() res: Response,
  ) {
    return this.service.downloadItem(cardId, versionId, itemId, res);
  }

  @Delete(':versionId/items/:itemId')
  @AdminOnly()
  deleteItem(
    @Param('cardId') cardId: string,
    @Param('versionId') versionId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.deleteItem(cardId, versionId, itemId, user.id, user.role as UserRole);
  }
}
