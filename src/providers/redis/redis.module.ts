import { Module, Global, OnModuleDestroy, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisProvider } from './redis.providers';
import { RedisHealthService } from './redis.health';
import { INJECTION_TOKENS } from '../../common/constants/injection-tokens';

@Global()
@Module({
  providers: [RedisProvider, RedisHealthService],
  exports: [RedisProvider, RedisHealthService],
})
export class RedisModule implements OnModuleDestroy {
  private readonly logger = new Logger(RedisModule.name);

  constructor(
    @Inject(INJECTION_TOKENS.REDIS)
    private readonly redis: Redis,
  ) {}

  async onModuleDestroy() {
    this.logger.log('Closing Redis connection...');
    await this.redis.quit();
    this.logger.log('Redis connection closed.');
  }
}
