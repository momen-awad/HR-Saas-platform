// src/database/tenant-scoped.database.ts

import {
  Injectable,
  Inject,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PG_POOL } from './database.providers';
import { TenantContext } from '../common/context/tenant.context';
import { RequestContext } from '../common/context/request.context';
import * as schema from './schema';

export type TenantScopedDb = NodePgDatabase<typeof schema>;

@Injectable()
export class TenantScopedDatabase {
  private readonly logger = new Logger(TenantScopedDatabase.name);

  private readonly statementTimeout = this.validateTimeout(
    process.env.DB_STATEMENT_TIMEOUT ?? '10s',
  );

  private readonly idleTxTimeout = this.validateTimeout(
    process.env.DB_IDLE_TX_TIMEOUT ?? '30s',
  );

  private readonly enableBleedingMonitor =
    process.env.ENABLE_TENANT_VERIFY === 'true' ||
    process.env.NODE_ENV !== 'production';

  constructor(
    @Inject(PG_POOL)
    private readonly pool: Pool,
  ) {}

  async transaction<T>(
    callback: (db: TenantScopedDb) => Promise<T>,
    options: { retries?: number } = { retries: 3 },
  ): Promise<T> {
    const tenantId = this.getTenantIdOrThrow();
    this.validateUuid(tenantId);

    const maxRetries = options.retries ?? 1;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const client = await this.pool.connect();
      const start = Date.now();

      try {
        await client.query('BEGIN');

        await client.query(
          `
          SELECT
            set_config('statement_timeout', $1, true),
            set_config('idle_in_transaction_session_timeout', $2, true),
            set_config('app.current_tenant', $3, true)
        `,
          [this.statementTimeout, this.idleTxTimeout, tenantId],
        );

        const db = drizzle(client, {
          schema,
          logger: process.env.NODE_ENV !== 'production',
        });

        const result = await callback(db);

        if (this.enableBleedingMonitor) {
          await this.verifyTenantContext(client, tenantId);
        }

        await client.query('COMMIT');

        const duration = Date.now() - start;

        this.logger.log(
          `[TX_COMMIT] tenant=${tenantId} request=${RequestContext.requestId} duration=${duration}ms`,
        );

        return result;
      } catch (error: any) {
        await client.query('ROLLBACK').catch((rollbackErr) =>
          this.logger.warn(`[ROLLBACK_FAILED] ${rollbackErr.message}`),
        );

        const isRetryable =
          error?.code === '40P01' || // deadlock_detected
          error?.code === '40001'; // serialization_failure

        if (isRetryable && attempt < maxRetries - 1) {
          client.release();

          const delay = Math.pow(2, attempt) * 50;

          this.logger.warn(
            `[TX_RETRY] tenant=${tenantId} attempt=${attempt + 1} delay=${delay}ms code=${error.code}`,
          );

          await this.sleep(delay);
          continue;
        }

        const duration = Date.now() - start;

        this.logger.error(
          `[TX_ROLLBACK] tenant=${tenantId} request=${RequestContext.requestId} duration=${duration}ms`,
          error?.stack || error,
        );

        throw error;
      } finally {
        client.release();
      }
    }

    throw new InternalServerErrorException(
      'Transaction failed after maximum retries',
    );
  }

  async execute<T>(callback: (db: TenantScopedDb) => Promise<T>): Promise<T> {
    return this.transaction(callback, { retries: 1 });
  }

  private getTenantIdOrThrow(): string {
    const tenantId = TenantContext.currentTenantId;

    if (!tenantId) {
      throw new InternalServerErrorException(
        'Tenant context is missing. Ensure request passed through Tenant middleware.',
      );
    }

    return tenantId;
  }

  private validateUuid(value: string): void {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(value)) {
      throw new InternalServerErrorException(
        'Security violation: invalid tenant UUID format',
      );
    }
  }

  private validateTimeout(value: string): string {
    const timeoutRegex = /^\d+(ms|s|m)$/i;

    if (!timeoutRegex.test(value)) {
      throw new Error(`Invalid timeout format: ${value}`);
    }

    return value;
  }

  private async verifyTenantContext(
    client: PoolClient,
    expectedTenantId: string,
  ): Promise<void> {
    const res = await client.query(
      `SELECT current_setting('app.current_tenant', true) AS tenant_id`,
    );

    const actualTenantId = res.rows[0]?.tenant_id;

    if (!actualTenantId || actualTenantId !== expectedTenantId) {
      this.logger.error(
        `[TENANT_BLEED] expected=${expectedTenantId} actual=${actualTenantId} request=${RequestContext.requestId}`,
      );

      throw new Error('Tenant context integrity violation detected');
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
