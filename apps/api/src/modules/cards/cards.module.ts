import { Module } from '@nestjs/common';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { SprintsModule } from '../sprints/sprints.module';

@Module({
  imports: [NotificationsModule, SprintsModule],
  controllers: [CardsController],
  providers: [CardsService],
  exports: [CardsService],
})
export class CardsModule {}
