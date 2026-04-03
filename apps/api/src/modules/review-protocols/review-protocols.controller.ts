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
import { CreateReviewProtocolDto } from './dto/create-review-protocol.dto';
import { UpdateReviewProtocolDto } from './dto/update-review-protocol.dto';
import { ReviewProtocolsService } from './review-protocols.service';

@ApiTags('review-protocols')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ReviewProtocolsController {
  constructor(private readonly service: ReviewProtocolsService) {}

  @Get('review-protocols')
  findAll(
    @Query('search') search?: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.service.findAll(search, includeArchived === 'true');
  }

  @Get('review-protocols/available')
  findAvailable(@Query('search') search?: string) {
    return this.service.findAvailable(search);
  }

  @Get('review-protocols/:id')
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post('review-protocols')
  create(@Body() dto: CreateReviewProtocolDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.id);
  }

  @Patch('review-protocols/:id')
  update(@Param('id') id: string, @Body() dto: UpdateReviewProtocolDto, @CurrentUser() user: any) {
    return this.service.update(id, dto, user.id);
  }

  @Patch('review-protocols/:id/archive')
  @HttpCode(HttpStatus.OK)
  toggleArchive(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.toggleArchive(id, user.id);
  }

  @Delete('review-protocols/:id')
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Get('cards/:cardId/review-protocol')
  getCardProtocol(@Param('cardId') cardId: string) {
    return this.service.getCardProtocol(cardId);
  }

  @Post('cards/:cardId/review-protocol/:protocolId')
  attachToCard(
    @Param('cardId') cardId: string,
    @Param('protocolId') protocolId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.attachToCard(cardId, protocolId, user.id, user.role);
  }

  @Delete('cards/:cardId/review-protocol')
  @HttpCode(HttpStatus.OK)
  detachFromCard(@Param('cardId') cardId: string, @CurrentUser() user: any) {
    return this.service.detachFromCard(cardId, user.id, user.role);
  }

  @Patch('cards/:cardId/review-protocol/items/:itemId/toggle')
  toggleCardItem(
    @Param('cardId') cardId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.toggleCardItem(cardId, itemId, user.id, user.role);
  }

  @Get('data-sources/:id/review-protocol')
  getDataSourceProtocol(@Param('id') id: string) {
    return this.service.getDataSourceProtocol(id);
  }

  @Post('data-sources/:id/review-protocol/:protocolId')
  @ManagerOrAdminOnly()
  attachToDataSource(
    @Param('id') id: string,
    @Param('protocolId') protocolId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.attachToDataSource(id, protocolId, user.role);
  }

  @Delete('data-sources/:id/review-protocol')
  @ManagerOrAdminOnly()
  @HttpCode(HttpStatus.OK)
  detachFromDataSource(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.detachFromDataSource(id, user.role);
  }
}
