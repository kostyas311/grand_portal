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
}
