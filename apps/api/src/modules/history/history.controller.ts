import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { HistoryService } from './history.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('history')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cards/:cardId/history')
export class HistoryController {
  constructor(private service: HistoryService) {}

  @Get()
  findAll(@Param('cardId') cardId: string) {
    return this.service.findByCard(cardId);
  }
}
