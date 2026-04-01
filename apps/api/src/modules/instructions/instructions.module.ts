import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { InstructionsController } from './instructions.controller';
import { InstructionsService } from './instructions.service';

@Module({
  imports: [PrismaModule, FilesModule, NotificationsModule],
  controllers: [InstructionsController],
  providers: [InstructionsService],
  exports: [InstructionsService],
})
export class InstructionsModule {}
