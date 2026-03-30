import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DataSourcesModule } from './modules/data-sources/data-sources.module';
import { CardsModule } from './modules/cards/cards.module';
import { SourceMaterialsModule } from './modules/source-materials/source-materials.module';
import { ResultsModule } from './modules/results/results.module';
import { HistoryModule } from './modules/history/history.module';
import { CommentsModule } from './modules/comments/comments.module';
import { FilesModule } from './modules/files/files.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    DataSourcesModule,
    CardsModule,
    SourceMaterialsModule,
    ResultsModule,
    HistoryModule,
    CommentsModule,
    FilesModule,
  ],
})
export class AppModule {}
