import { Controller, Post, Get, Logger } from '@nestjs/common';
import { TenantId } from '../decorators/tenant-id.decorator';
import { JobSchedulerService } from '../../jobs/job-scheduler.service';
import { QUEUE_NAMES } from '../../jobs/queue-names';
import { JOB_NAMES } from '../../jobs/interfaces/job-data.interfaces';
import { createSuccessResponse } from '../types/api-response.types';
import { Public } from '../../modules/auth/decorators/public.decorator';

@Public()
@Controller('debug/jobs')
export class JobTestController {
  private readonly logger = new Logger(JobTestController.name);

  constructor(private readonly jobScheduler: JobSchedulerService) {}

  @Post('test-enqueue')
  async testEnqueue(@TenantId() tenantId: string) {
    const job = await this.jobScheduler.enqueue(
      QUEUE_NAMES.DEFAULT,
      'test-job',
      {
        tenantId,
        triggeredBy: 'debug-controller',
        message: 'Hello from test job',
        timestamp: new Date().toISOString(),
      },
    );

    return createSuccessResponse({
      message: 'Test job enqueued',
      jobId: job.id,
      queue: QUEUE_NAMES.DEFAULT,
      note: 'No processor registered yet — job will wait in queue',
    });
  }

  @Post('test-delayed')
  async testDelayed(@TenantId() tenantId: string) {
    const job = await this.jobScheduler.enqueueDelayed(
      QUEUE_NAMES.DEFAULT,
      'test-delayed-job',
      {
        tenantId,
        triggeredBy: 'debug-controller',
        message: 'This was delayed by 10 seconds',
      },
      10000,
    );

    return createSuccessResponse({
      message: 'Delayed test job enqueued (10s delay)',
      jobId: job.id,
    });
  }

  @Get('queue-status')
  async getQueueStatus() {
    const statuses = await this.jobScheduler.getQueueStatuses();
    return createSuccessResponse(statuses);
  }
}
