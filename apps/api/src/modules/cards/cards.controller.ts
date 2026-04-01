import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CardsService } from './cards.service';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { AssignDto } from './dto/assign.dto';
import { CardsFilterDto } from './dto/cards-filter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminOnly } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('cards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cards')
export class CardsController {
  constructor(private service: CardsService) {}

  @Get()
  findAll(@Query() filter: CardsFilterDto, @CurrentUser() user: any) {
    return this.service.findAll(filter, user.id, user.role as UserRole);
  }

  @Get('stats')
  getStats(
    @Query('sprintId') sprintId?: string,
    @Query('dueDateFrom') dueDateFrom?: string,
    @Query('dueDateTo') dueDateTo?: string,
  ) {
    return this.service.getStats({
      sprintId,
      dueDateFrom,
      dueDateTo,
    });
  }

  @Get('done')
  findDone(
    @Query('search') search?: string,
    @Query('dataSourceId') dataSourceId?: string,
    @Query('sprintId') sprintId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.service.findDone({
      search,
      dataSourceId,
      sprintId,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      sortOrder,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  create(@Body() dto: CreateCardDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCardDto, @CurrentUser() user: any) {
    return this.service.update(id, dto, user.id, user.role as UserRole);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.service.changeStatus(id, dto, user.id, user.role as UserRole);
  }

  @Patch(':id/assign')
  @HttpCode(HttpStatus.OK)
  assign(@Param('id') id: string, @Body() dto: AssignDto, @CurrentUser() user: any) {
    return this.service.assign(id, dto, user.id);
  }

  @Delete(':id')
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  hardDelete(@Param('id') id: string) {
    return this.service.hardDelete(id);
  }

  @Post(':id/watch')
  @HttpCode(HttpStatus.OK)
  toggleWatch(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.toggleWatch(id, user.id);
  }

  @Get(':id/watch')
  getWatchStatus(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.getWatchStatus(id, user.id);
  }
}
