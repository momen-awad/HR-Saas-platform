// src/scheduler/scheduler.module.ts

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CronTasksService } from './cron-tasks.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [CronTasksService],
})
export class AppSchedulerModule {}
