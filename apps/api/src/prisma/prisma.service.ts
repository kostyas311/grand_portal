import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      errorFormat: 'minimal',
      log:
        process.env.NODE_ENV === 'production'
          ? ['warn', 'error']
          : ['warn', 'error', 'info'],
      transactionOptions: {
        maxWait: Number(process.env.PRISMA_TRANSACTION_MAX_WAIT_MS || 5000),
        timeout: Number(process.env.PRISMA_TRANSACTION_TIMEOUT_MS || 15000),
      },
    });
  }

  async onModuleInit() {
    await this.connectWithRetry();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async healthCheck() {
    await this.$queryRaw`SELECT 1`;
    return true;
  }

  private async connectWithRetry() {
    const maxAttempts = Number(process.env.PRISMA_CONNECT_MAX_RETRIES || 5);
    const retryDelayMs = Number(process.env.PRISMA_CONNECT_RETRY_DELAY_MS || 3000);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.$connect();
        if (attempt > 1) {
          this.logger.warn(`Подключение к БД восстановлено на попытке ${attempt}`);
        }
        return;
      } catch (error: any) {
        const isLastAttempt = attempt === maxAttempts;
        this.logger.error(
          `Не удалось подключиться к БД (попытка ${attempt}/${maxAttempts})`,
          error?.stack || String(error),
        );

        if (isLastAttempt) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }
}
