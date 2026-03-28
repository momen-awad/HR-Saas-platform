import { Controller, Get, Inject } from '@nestjs/common';
import { INJECTION_TOKENS } from '../constants/injection-tokens';
import type { DrizzleDatabase } from '../../database/database.providers';
import { sql } from 'drizzle-orm';
import { RedisHealthService } from '../../providers/redis/redis.health';
import { JobSchedulerService } from '../../jobs/job-scheduler.service';
import { createSuccessResponse } from '../types/api-response.types';
import { Public } from '../../modules/auth/decorators/public.decorator';

@Controller()
export class HealthController {
  constructor(
    @Inject(INJECTION_TOKENS.DRIZZLE)
    private readonly db: DrizzleDatabase,
    private readonly redisHealth: RedisHealthService,
    private readonly jobScheduler: JobSchedulerService,
  ) {}

  @Public()
  @Get('health')
  async check() {
    const checks: Record<string, any> = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };

    try {
      await this.db.execute(sql`SELECT 1`);
      checks.database = { status: 'connected' };
    } catch (error) {
      checks.database = { status: 'disconnected', error: error.message };
      checks.status = 'degraded';
    }

    const redisStatus = await this.redisHealth.check();
    checks.redis = redisStatus;
    if (redisStatus.status !== 'connected') {
      checks.status = 'degraded';
    }

    return createSuccessResponse(checks);
  }

  @Public()
  @Get('health/detailed')
  async detailedCheck() {
    const checks: Record<string, any> = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };

    try {
      const result = await this.db.execute(
        sql`SELECT count(*) as count FROM event_outbox WHERE status = 'pending'`,
      );
      checks.database = {
        status: 'connected',
        pendingOutboxEvents: result.rows[0]?.count || 0,
      };
    } catch (error) {
      checks.database = { status: 'disconnected', error: error.message };
      checks.status = 'degraded';
    }

    checks.redis = await this.redisHealth.check();
    if (checks.redis.status !== 'connected') {
      checks.status = 'degraded';
    }

    try {
      checks.queues = await this.jobScheduler.getQueueStatuses();
    } catch (error) {
      checks.queues = { status: 'error', error: error.message };
    }

    return createSuccessResponse(checks);
  }
}
