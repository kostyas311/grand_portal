import { Module } from '@nestjs/common';
import { AdminRequestsController } from './admin-requests.controller';
import { AdminRequestsService } from './admin-requests.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [AdminRequestsController],
  providers: [AdminRequestsService],
})
export class AdminRequestsModule {}
