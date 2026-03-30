import {
  Controller, Get, Post, Delete, Body, Param, Res, UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { SourceMaterialsService } from './source-materials.service';
import { AddMaterialDto } from './dto/add-material.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('source-materials')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cards/:cardId/materials')
export class SourceMaterialsController {
  constructor(private service: SourceMaterialsService) {}

  @Get()
  findAll(@Param('cardId') cardId: string) {
    return this.service.findAll(cardId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '524288000') },
  }))
  addMaterial(
    @Param('cardId') cardId: string,
    @Body() dto: AddMaterialDto,
    @CurrentUser() user: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.service.addMaterial(cardId, dto, user.id, file);
  }

  @Get('download-all')
  downloadAll(@Param('cardId') cardId: string, @Res() res: Response) {
    return this.service.downloadAll(cardId, res);
  }

  @Get(':materialId/download')
  download(
    @Param('cardId') cardId: string,
    @Param('materialId') materialId: string,
    @Res() res: Response,
  ) {
    return this.service.download(cardId, materialId, res);
  }

  @Delete(':materialId')
  delete(
    @Param('cardId') cardId: string,
    @Param('materialId') materialId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.delete(cardId, materialId, user.id);
  }
}
