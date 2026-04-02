import { Module } from '@nestjs/common';
import { ReviewProtocolsController } from './review-protocols.controller';
import { ReviewProtocolsService } from './review-protocols.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ReviewProtocolsController],
  providers: [ReviewProtocolsService],
  exports: [ReviewProtocolsService],
})
export class ReviewProtocolsModule {}
