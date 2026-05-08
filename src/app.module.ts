// src/app.module.ts

import {
  Module,
  MiddlewareConsumer,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { RlsModule } from './database/rls/rls.module';
import { RedisModule } from './providers/redis/redis.module';
import { CommonModule } from './common/common.module';
import { EventBusModule } from './common/events/event-bus.module';
import { JobsModule } from './jobs/jobs.module';
import { AppSchedulerModule } from './scheduler/scheduler.module';
import { HealthModule } from './common/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { DepartmentModule } from './modules/department/department.module';
import { EmployeeModule } from './modules/employee/employee.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { TenantResolverMiddleware } from './common/middleware/tenant-resolver.middleware';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RbacModule } from './modules/rbac/rbac.module';

@Module({
  imports: [
    // Infrastructure
    AppConfigModule,
    DatabaseModule,
    RlsModule,
    RedisModule,
    CommonModule,
    EventBusModule,
    JobsModule,
    AppSchedulerModule,
    HealthModule,

    // Domain modules
    RbacModule,
    AuthModule,
    TenantModule,
    DepartmentModule,
    EmployeeModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*path');

    consumer
      .apply(TenantResolverMiddleware)
      .exclude(
        { path: 'health', method: RequestMethod.GET },
        { path: 'health/*path', method: RequestMethod.GET },
        { path: 'auth/*path', method: RequestMethod.ALL },
        { path: 'admin/tenants', method: RequestMethod.ALL },
        { path: 'admin/tenants/*path', method: RequestMethod.ALL },
      )
      .forRoutes('*path');
  }
}
