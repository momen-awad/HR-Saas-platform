// src/jobs/jobs.module.ts

import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from './queue-names';
import { JobSchedulerService } from './job-scheduler.service';

/**
 * JobsModule configures BullMQ queues and provides the JobSchedulerService.
 *
 * Architecture:
 * - This module registers QUEUES (the named pipes).
 * - PROCESSORS (workers that consume from queues) are registered
 *   in their respective feature modules.
 *
 * Example: The PayrollModule will register:
 *   @Processor(QUEUE_NAMES.PAYROLL)
 *   export class PayrollProcessor extends BaseProcessor { ... }
 *
 * This keeps queue infrastructure centralized while processing
 * logic stays in the domain module.
 */
@Global()
@Module({
  imports: [
    // BullMQ root configuration (Redis connection for all queues)
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
          maxRetriesPerRequest: null, // Required by BullMQ
        },
        defaultJobOptions: {
          removeOnComplete: { age: 86400, count: 1000 },
          removeOnFail: { age: 604800, count: 5000 },
        },
      }),
    }),

    // Register individual queues
    BullModule.registerQueue(
      { name: QUEUE_NAMES.NOTIFICATION },
      { name: QUEUE_NAMES.PAYROLL },
      { name: QUEUE_NAMES.ATTENDANCE },
      { name: QUEUE_NAMES.LEAVE },
      { name: QUEUE_NAMES.AUDIT },
      { name: QUEUE_NAMES.DEFAULT },
    ),
  ],
  providers: [JobSchedulerService],
  exports: [
    JobSchedulerService,
    BullModule, // Export so feature modules can register processors
  ],
})
export class JobsModule {}
