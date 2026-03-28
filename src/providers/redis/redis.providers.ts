import { Provider, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { INJECTION_TOKENS } from '../../common/constants/injection-tokens';

export const RedisProvider: Provider = {
  provide: INJECTION_TOKENS.REDIS,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): Redis => {
    const logger = new Logger('RedisModule');

    const host = configService.get<string>('REDIS_HOST', 'localhost');
    const port = configService.get<number>('REDIS_PORT', 6379);
    const password = configService.get<string>('REDIS_PASSWORD', '');
    const isProduction = configService.get<string>('NODE_ENV') === 'production';

    const redis = new Redis({
      host,
      port,
      password: password || undefined,
      tls: isProduction ? {} : undefined,

      connectTimeout: 10000,
      commandTimeout: 5000,

      retryStrategy(times: number): number | null {
        if (times > 20) {
          logger.error('Redis: Max reconnection attempts reached. Giving up.');
          return null;
        }
        const delay = Math.min(times * 500, 10000);
        logger.warn(`Redis: Reconnecting attempt ${times}, delay ${delay}ms`);
        return delay;
      },

      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
      // keyPrefix: 'hrs:',  // تم إزالتها لتجنب التعارض مع BullMQ
    });

    redis.on('connect', () => {
      logger.log(`✅ Redis connected: ${host}:${port}`);
    });

    redis.on('error', (error) => {
      logger.error(`Redis error: ${error.message}`);
    });

    redis.on('close', () => {
      logger.warn('Redis connection closed');
    });

    redis.on('reconnecting', () => {
      logger.warn('Redis reconnecting...');
    });

    return redis;
  },
};
