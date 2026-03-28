// src/jobs/base.processor.ts

import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { TenantContext } from '../common/context/tenant.context';
import { BaseJobData } from './interfaces/job-data.interfaces';

/**
 * Abstract base class for all job processors.
 *
 * Provides:
 * 1. Tenant context setup — CRITICAL: background jobs don't have HTTP request
 *    context, so we must set tenant context from the job data.
 * 2. Structured logging with job metadata.
 * 3. Error handling with context.
 * 4. Execution time tracking.
 *
 * Usage:
 *   @Processor(QUEUE_NAMES.PAYROLL)
 *   export class PayrollProcessor extends BaseProcessor {
 *     protected readonly logger = new Logger(PayrollProcessor.name);
 *
 *     @WorkerHost()
 *     async process(job: Job<PayrollCalculationJobData>) {
 *       return this.executeWithTenantContext(job, async (data) => {
 *         // TenantContext.currentTenantId is now available
 *         await this.payrollService.calculate(data.payrollRunId);
 *       });
 *     }
 *   }
 */
export abstract class BaseProcessor {
  protected abstract readonly logger: Logger;

  /**
   * Execute a job handler within tenant context.
   *
   * This method:
   * 1. Extracts tenantId from job data
   * 2. Sets up TenantContext (AsyncLocalStorage)
   * 3. Logs job start/completion/failure
   * 4. Measures execution time
   * 5. Returns the result or throws with context
   */
  protected async executeWithTenantContext<T extends BaseJobData, R>(
    job: Job<T>,
    handler: (data: T) => Promise<R>,
  ): Promise<R> {
    const { tenantId, triggeredBy, correlationId } = job.data;
    const startTime = Date.now();

    const jobContext = {
      jobId: job.id,
      jobName: job.name,
      queue: job.queueName,
      attempt: job.attemptsMade + 1,
      tenantId,
      triggeredBy,
      correlationId,
    };

    this.logger.log(
      `Job started: ${job.name} [${job.id}] (attempt ${jobContext.attempt})`,
      jobContext,
    );

    try {
      // Run the handler within tenant context
      const result = await TenantContext.run(
        { tenantId, tenantSlug: undefined, tenantTimezone: undefined, tenantStatus: undefined },
        () => handler(job.data),
      );

      const duration = Date.now() - startTime;
      this.logger.log(
        `Job completed: ${job.name} [${job.id}] (${duration}ms)`,
        { ...jobContext, durationMs: duration },
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Job failed: ${job.name} [${job.id}] (${duration}ms) — ${error.message}`,
        error.stack,
        { ...jobContext, durationMs: duration },
      );
      throw error; // BullMQ handles retries based on queue config
    }
  }

  /**
   * Helper to update job progress (0-100).
   * Useful for long-running jobs like payroll calculation.
   */
  protected async updateProgress(
    job: Job,
    progress: number,
    message?: string,
  ): Promise<void> {
    await job.updateProgress(progress);
    if (message) {
      this.logger.debug(
        `Job progress: ${job.name} [${job.id}] — ${progress}% — ${message}`,
      );
    }
  }
}
