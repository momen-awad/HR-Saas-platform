import { Controller, Get, Inject } from '@nestjs/common';
import { INJECTION_TOKENS } from '../constants/injection-tokens';
import type { DrizzleDatabase } from '../../database/database.providers';
import { sql } from 'drizzle-orm';
import { createSuccessResponse } from '../types/api-response.types';

@Controller()
export class HealthController {
  constructor(
    @Inject(INJECTION_TOKENS.DRIZZLE)
    private readonly db: DrizzleDatabase,
  ) {}

  @Get('health')
  async check() {
    const checks: Record<string, any> = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };

    try {
      await this.db.execute(sql`SELECT 1 as check`);
      checks.database = { status: 'connected' };
    } catch (error) {
      checks.database = { status: 'disconnected', error: error.message };
      checks.status = 'degraded';
    }

    return createSuccessResponse(checks);
  }
}
