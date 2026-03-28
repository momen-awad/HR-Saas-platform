import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { INJECTION_TOKENS } from '../../common/constants/injection-tokens';

@Injectable()
export class RedisHealthService {
  private readonly logger = new Logger(RedisHealthService.name);

  constructor(
    @Inject(INJECTION_TOKENS.REDIS)
    private readonly redis: Redis,
  ) {}

  async check(): Promise<{ status: string; latencyMs?: number; error?: string }> {
    try {
      const start = Date.now();
      await this.redis.ping();
      const latencyMs = Date.now() - start;
      return { status: 'connected', latencyMs };
    } catch (error) {
      return { status: 'disconnected', error: error.message };
    }
  }
}
