import { Module, Global, OnModuleDestroy, Inject, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { PoolProvider, DrizzleProvider, PG_POOL } from './database.providers';
import { TenantScopedDatabase } from './tenant-scoped.database'
@Global()
@Module({
  providers: [PoolProvider, DrizzleProvider, TenantScopedDatabase],
  exports: [PoolProvider,DrizzleProvider, TenantScopedDatabase],
})
export class DatabaseModule implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseModule.name);
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onModuleDestroy() {
    this.logger.log('Closing database connection pool...');
    await this.pool.end();
    this.logger.log('Database connection pool closed.');
  }
}
