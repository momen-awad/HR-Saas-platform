import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { EventTestController } from './event-test.controller';
import { JobTestController } from './job-test.controller';

@Module({
  controllers: [
    HealthController,
    ...(process.env.NODE_ENV !== 'production'
      ? [EventTestController, JobTestController]
      : []),
  ],
})
export class HealthModule {}
