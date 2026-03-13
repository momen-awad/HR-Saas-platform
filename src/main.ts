// src/main.ts

import { NestFactory, Reflector } from '@nestjs/core';
import {
  ValidationPipe,
  Logger,
  VersioningType,
  RequestMethod,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);
  const apiPrefix = configService.get<string>('app.apiPrefix', 'api');
  

  // ✅ Global prefix now includes version: /api/v1
  // ✅ Exclude health check from prefix & versioning
  app.setGlobalPrefix(apiPrefix, {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  // ✅ URI Versioning enabled with default v1
  app.enableVersioning({
    type: VersioningType.URI,
    
  });

  // ✅ Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  // ✅ Global Exception Filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ✅ Global Interceptors (New)
  app.useGlobalInterceptors(
    new TimeoutInterceptor(),
    new ResponseTransformInterceptor(),
  );

  // ✅ CORS Configuration
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGINS', '*').split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
      'X-Idempotency-Key',
      'X-Tenant-ID',
    ],
    exposedHeaders: [
      'X-Request-ID',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
    maxAge: 86400,
  });

  // ✅ Graceful Shutdown
  app.enableShutdownHooks();

  await app.listen(port);

  logger.log(
    `🚀 Application running on: http://localhost:${port}/${apiPrefix}`,
  );
  logger.log(`📝 Environment: ${configService.get<string>('app.nodeEnv')}`);
}

bootstrap();
