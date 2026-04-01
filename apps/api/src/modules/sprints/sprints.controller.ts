import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ManagerOrAdminOnly } from '../../common/decorators/roles.decorator';
import { SprintsService } from './sprints.service';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';
import { CloseSprintDto } from './dto/close-sprint.dto';

@ApiTags('sprints')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sprints')
export class SprintsController {
  constructor(private readonly sprintsService: SprintsService) {}

  @Get()
  findAll() {
    return this.sprintsService.findAll();
  }

  @Get('current')
  getCurrent() {
    return this.sprintsService.getCurrent();
  }

  @Post()
  @ManagerOrAdminOnly()
  create(@Body() dto: CreateSprintDto) {
    return this.sprintsService.create(dto);
  }

  @Patch(':id')
  @ManagerOrAdminOnly()
  update(@Param('id') id: string, @Body() dto: UpdateSprintDto) {
    return this.sprintsService.update(id, dto);
  }

  @Post(':id/close')
  @ManagerOrAdminOnly()
  close(@Param('id') id: string, @Body() dto: CloseSprintDto) {
    return this.sprintsService.close(id, dto);
  }

  @Post(':id/transfer-open-cards/:targetSprintId')
  @ManagerOrAdminOnly()
  transferOpenCards(
    @Param('id') id: string,
    @Param('targetSprintId') targetSprintId: string,
  ) {
    return this.sprintsService.transferOpenCards(id, targetSprintId);
  }
}
