// src/app.module.ts

import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { RlsModule } from './database/rls/rls.module';
import { HealthModule } from './common/health/health.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { TenantResolverMiddleware } from './common/middleware/tenant-resolver.middleware';
import { DebugModule } from './debug/debug.module';
import { TestTenantController } from './test-tenant.controller';
import { CommonModule } from './common/common.module';
import { TenantDebugController } from './debug/tenant-debug.controller';
import { EventBusModule } from './common/events/event-bus.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    RlsModule,
    EventBusModule, 
    HealthModule,
    DebugModule,
    CommonModule,
    
    
  ],
  controllers: [
    // ✅ مكانه الصح هنا فقط
    TestTenantController,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // 1️⃣ Request ID middleware — applies to all routes
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes('*path');

    // 2️⃣ Tenant resolver middleware — applies to all routes EXCEPT public paths
    consumer
      .apply(TenantResolverMiddleware)
      .exclude(
        'health',                     // Health check
        'api/v1/auth/login',           // Auth routes
        'api/v1/auth/register',
        'api/v1/auth/forgot-password',
        'api/v1/auth/reset-password',
        'api/v1/admin/tenants/*path',   // Admin routes (system-level)
      )
      .forRoutes('*path');
  }
}
