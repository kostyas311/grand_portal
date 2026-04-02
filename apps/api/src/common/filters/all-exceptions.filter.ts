import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (response.headersSent) {
      this.logger.error(
        `Исключение после отправки заголовков: ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      return;
    }

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Внутренняя ошибка сервера';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = this.normalizeMessage(typeof res === 'string' ? res : (res as any).message || message);
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      ({ status, message } = this.mapPrismaKnownError(exception));
      this.logger.error(
        `Prisma error ${exception.code}: ${request.method} ${request.url}`,
        exception.stack,
      );
    } else if (
      exception instanceof Prisma.PrismaClientInitializationError ||
      exception instanceof Prisma.PrismaClientRustPanicError ||
      exception instanceof Prisma.PrismaClientUnknownRequestError
    ) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      message = 'Сервис базы данных временно недоступен';
      this.logger.error(
        `Prisma infrastructure error: ${request.method} ${request.url}`,
        exception.stack,
      );
    } else {
      this.logger.error(
        `Unhandled exception: ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private normalizeMessage(message: unknown) {
    if (Array.isArray(message)) {
      return message.join('; ');
    }

    if (typeof message === 'string') {
      return message;
    }

    return 'Внутренняя ошибка сервера';
  }

  private mapPrismaKnownError(error: Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          message: 'Нарушено ограничение уникальности данных',
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Запрашиваемая запись не найдена',
        };
      case 'P1001':
      case 'P1002':
      case 'P1008':
      case 'P1017':
        return {
          status: HttpStatus.SERVICE_UNAVAILABLE,
          message: 'Сервис базы данных временно недоступен',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Внутренняя ошибка сервера',
        };
    }
  }
}
