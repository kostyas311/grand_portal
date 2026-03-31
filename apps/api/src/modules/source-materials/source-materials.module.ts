import { Module } from '@nestjs/common';
import { SourceMaterialsController } from './source-materials.controller';
import { SourceMaterialsService } from './source-materials.service';
import { FilesModule } from '../files/files.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [FilesModule, NotificationsModule],
  controllers: [SourceMaterialsController],
  providers: [SourceMaterialsService],
})
export class SourceMaterialsModule {}
