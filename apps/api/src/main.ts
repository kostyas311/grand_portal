import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import * as helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

// Fix BigInt JSON serialization (Prisma returns BigInt for fileSize fields)
(BigInt.prototype as any).toJSON = function () { return Number(this); };

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new AllExceptionsFilter());

  // Security
  app.use(helmet.default());
  app.use(cookieParser());

  // CORS — только для разработки; в production — nginx обрабатывает
  if (process.env.NODE_ENV !== 'production') {
    app.enableCors({
      origin: 'http://localhost:3000',
      credentials: true,
    });
  }

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger (только в development)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('NormBase Portal API')
      .setDescription('API для внутреннего портала документооборота')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 NormBase API running on port ${port}`);
}

bootstrap();
