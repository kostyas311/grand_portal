import {
  Controller, Get, Post, Delete, Body, Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminOnly } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('comments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cards/:cardId/comments')
export class CommentsController {
  constructor(private service: CommentsService) {}

  @Get()
  findAll(@Param('cardId') cardId: string) {
    return this.service.findAll(cardId);
  }

  @Post()
  create(
    @Param('cardId') cardId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: any,
  ) {
    return this.service.create(cardId, dto, user.id);
  }

  @Delete(':commentId')
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  delete(@Param('cardId') cardId: string, @Param('commentId') commentId: string) {
    return this.service.delete(cardId, commentId);
  }
}
