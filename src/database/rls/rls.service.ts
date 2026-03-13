import { Injectable, Inject, Logger } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { PG_POOL } from '../database.providers';

/**
 * RlsService manages the PostgreSQL session variable
 * used by Row-Level Security policies.
 */
@Injectable()
export class RlsService {
  private readonly logger = new Logger(RlsService.name);

  constructor(
    @Inject(PG_POOL)
    private readonly pool: Pool,
  ) {}

  async executeWithTenant<T>(
    tenantId: string,
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      this.validateUuid(tenantId);

      await client.query(`SET LOCAL app.current_tenant = '${tenantId}'`);

      return await callback(client);
    } finally {
      client.release();
    }
  }

  async executeInTransaction<T>(
    tenantId: string,
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      this.validateUuid(tenantId);

      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant = '${tenantId}'`);

      const result = await callback(client);

      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private validateUuid(value: string): void {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(value)) {
      throw new Error(`Invalid UUID format for tenant_id: ${value}`);
    }
  }
}
