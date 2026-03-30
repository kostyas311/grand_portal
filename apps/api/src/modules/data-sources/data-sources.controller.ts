import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DataSourcesService } from './data-sources.service';
import { CreateDataSourceDto } from './dto/create-data-source.dto';
import { UpdateDataSourceDto } from './dto/update-data-source.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminOnly, ManagerOrAdminOnly } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('data-sources')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('data-sources')
export class DataSourcesController {
  constructor(private service: DataSourcesService) {}

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.service.findAll(search, includeArchived === 'true');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  @ManagerOrAdminOnly()
  create(@Body() dto: CreateDataSourceDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.id);
  }

  @Patch(':id')
  @ManagerOrAdminOnly()
  update(@Param('id') id: string, @Body() dto: UpdateDataSourceDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/archive')
  @ManagerOrAdminOnly()
  @HttpCode(HttpStatus.OK)
  toggleArchive(@Param('id') id: string) {
    return this.service.toggleArchive(id);
  }

  @Delete(':id')
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
