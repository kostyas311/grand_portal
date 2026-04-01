import {
  Body,
  Controller,
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
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminRequestsService } from './admin-requests.service';
import { CreateAdminRequestDto } from './dto/create-admin-request.dto';
import { CompleteAdminRequestDto } from './dto/complete-admin-request.dto';
import { AdminRequestsFilterDto } from './dto/admin-requests-filter.dto';
import { RequestClarificationAdminRequestDto } from './dto/request-clarification-admin-request.dto';
import { ReplyAdminRequestDto } from './dto/reply-admin-request.dto';
import { RejectAdminRequestDto } from './dto/reject-admin-request.dto';

@ApiTags('admin-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin-requests')
export class AdminRequestsController {
  constructor(private readonly adminRequestsService: AdminRequestsService) {}

  @Get()
  findAll(@Query() filter: AdminRequestsFilterDto, @CurrentUser() user: any) {
    return this.adminRequestsService.findAll(filter, user.id, user.role as UserRole);
  }

  @Post()
  create(@Body() dto: CreateAdminRequestDto, @CurrentUser() user: any) {
    return this.adminRequestsService.create(dto, user.id, user.role as UserRole);
  }

  @Patch(':id/complete')
  @HttpCode(HttpStatus.OK)
  complete(
    @Param('id') id: string,
    @Body() dto: CompleteAdminRequestDto,
    @CurrentUser() user: any,
  ) {
    return this.adminRequestsService.complete(id, dto, user.id, user.role as UserRole);
  }

  @Patch(':id/request-clarification')
  @HttpCode(HttpStatus.OK)
  requestClarification(
    @Param('id') id: string,
    @Body() dto: RequestClarificationAdminRequestDto,
    @CurrentUser() user: any,
  ) {
    return this.adminRequestsService.requestClarification(id, dto, user.id, user.role as UserRole);
  }

  @Patch(':id/reply')
  @HttpCode(HttpStatus.OK)
  reply(
    @Param('id') id: string,
    @Body() dto: ReplyAdminRequestDto,
    @CurrentUser() user: any,
  ) {
    return this.adminRequestsService.reply(id, dto, user.id, user.role as UserRole);
  }

  @Patch(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @Param('id') id: string,
    @Body() dto: RejectAdminRequestDto,
    @CurrentUser() user: any,
  ) {
    return this.adminRequestsService.reject(id, dto, user.id, user.role as UserRole);
  }
}
