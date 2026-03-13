import { Provider, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { INJECTION_TOKENS } from '../common/constants/injection-tokens';

export type DrizzleDatabase = NodePgDatabase<typeof schema>;
export const PG_POOL = 'PG_POOL';

export const PoolProvider: Provider = {
  provide: PG_POOL,
  inject: [ConfigService],
  useFactory: async (configService: ConfigService): Promise<Pool> => {
    const logger = new Logger('DatabaseModule');
    const pool = new Pool({
      host: configService.get('database.host'),
      port: configService.get('database.port'),
      user: configService.get('database.user'),
      password: configService.get('database.password'),
      database: configService.get('database.name'),
      ssl: configService.get('database.ssl') ? { rejectUnauthorized: false } : false,
      min: configService.get('database.poolMin'),
      max: configService.get('database.poolMax'),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      application_name: 'hr-saas-api',
    });

    try {
      const client = await pool.connect();
      const result = await client.query('SELECT NOW() as now, current_database() as db');
      logger.log(`✅ Database connected: ${result.rows[0].db} at ${configService.get('database.host')}`);
      client.release();
    } catch (error) {
      logger.error(`❌ Database connection failed: ${error.message}`);
      throw error;
    }

    pool.on('error', (err) => {
      logger.error(`Unexpected pool error: ${err.message}`, err.stack);
    });

    return pool;
  },
};

export const DrizzleProvider: Provider = {
  provide: INJECTION_TOKENS.DRIZZLE,
  inject: [PG_POOL],
  useFactory: (pool: Pool): DrizzleDatabase => {
    return drizzle(pool, {
      schema,
      logger: process.env.NODE_ENV === 'development',
    });
  },
};
