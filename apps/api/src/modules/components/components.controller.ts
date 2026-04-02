import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminOnly, ManagerOrAdminOnly } from '../../common/decorators/roles.decorator';
import { ComponentsService } from './components.service';
import { CreateComponentDto } from './dto/create-component.dto';
import { UpdateComponentDto } from './dto/update-component.dto';

@ApiTags('components')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ComponentsController {
  constructor(private readonly service: ComponentsService) {}

  @Get('components')
  findAll(
    @Query('search') search?: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.service.findAll(search, includeArchived === 'true');
  }

  @Get('components/available')
  findAvailable(@Query('search') search?: string) {
    return this.service.findAvailable(search);
  }

  @Get('components/:id')
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post('components')
  create(@Body() dto: CreateComponentDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.id);
  }

  @Patch('components/:id')
  update(@Param('id') id: string, @Body() dto: UpdateComponentDto, @CurrentUser() user: any) {
    return this.service.update(id, dto, user.id, user.role);
  }

  @Patch('components/:id/archive')
  @HttpCode(HttpStatus.OK)
  toggleArchive(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.toggleArchive(id, user.id, user.role);
  }

  @Delete('components/:id')
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.delete(id, user.id);
  }

  @Get('cards/:cardId/components')
  getCardComponents(@Param('cardId') cardId: string) {
    return this.service.getCardComponents(cardId);
  }

  @Post('cards/:cardId/components/:componentId')
  attachToCard(
    @Param('cardId') cardId: string,
    @Param('componentId') componentId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.attachToCard(cardId, componentId, user.id, user.role);
  }

  @Delete('cards/:cardId/components/:componentId')
  @HttpCode(HttpStatus.OK)
  detachFromCard(
    @Param('cardId') cardId: string,
    @Param('componentId') componentId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.detachFromCard(cardId, componentId, user.id, user.role);
  }

  @Get('data-sources/:id/components')
  getDataSourceComponents(@Param('id') id: string) {
    return this.service.getDataSourceComponents(id);
  }

  @Post('data-sources/:id/components/:componentId')
  @ManagerOrAdminOnly()
  attachToDataSource(
    @Param('id') id: string,
    @Param('componentId') componentId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.attachToDataSource(id, componentId, user.id, user.role);
  }

  @Delete('data-sources/:id/components/:componentId')
  @ManagerOrAdminOnly()
  @HttpCode(HttpStatus.OK)
  detachFromDataSource(
    @Param('id') id: string,
    @Param('componentId') componentId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.detachFromDataSource(id, componentId, user.role);
  }
}
