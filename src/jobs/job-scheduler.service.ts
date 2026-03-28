// src/jobs/job-scheduler.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, JobsOptions } from 'bullmq';
import { QUEUE_NAMES, QueueName } from './queue-names';
import { BaseJobData, JOB_NAMES, JobName } from './interfaces/job-data.interfaces';

/**
 * JobSchedulerService provides a centralized, type-safe API for enqueueing
 * background jobs from anywhere in the application.
 *
 * Instead of modules importing BullMQ directly, they inject this service:
 *
 *   constructor(private readonly jobScheduler: JobSchedulerService) {}
 *
 *   async finalizePayroll(runId: string) {
 *     // ... finalize logic ...
 *     await this.jobScheduler.enqueue(
 *       QUEUE_NAMES.PAYROLL,
 *       JOB_NAMES.GENERATE_PAYSLIP,
 *       { tenantId, payrollRunId: runId, ... },
 *       { priority: 1 },
 *     );
 *   }
 *
 * Benefits:
 * - Type safety for job data
 * - Centralized default options
 * - Easy to add logging, metrics, rate limiting
 * - Decouples business code from BullMQ API
 */
@Injectable()
export class JobSchedulerService {
  private readonly logger = new Logger(JobSchedulerService.name);
  private readonly queues: Map<string, Queue> = new Map();

  constructor(
    @InjectQueue(QUEUE_NAMES.NOTIFICATION)
    private readonly notificationQueue: Queue,

    @InjectQueue(QUEUE_NAMES.PAYROLL)
    private readonly payrollQueue: Queue,

    @InjectQueue(QUEUE_NAMES.ATTENDANCE)
    private readonly attendanceQueue: Queue,

    @InjectQueue(QUEUE_NAMES.LEAVE)
    private readonly leaveQueue: Queue,

    @InjectQueue(QUEUE_NAMES.AUDIT)
    private readonly auditQueue: Queue,

    @InjectQueue(QUEUE_NAMES.DEFAULT)
    private readonly defaultQueue: Queue,
  ) {
    this.queues.set(QUEUE_NAMES.NOTIFICATION, this.notificationQueue);
    this.queues.set(QUEUE_NAMES.PAYROLL, this.payrollQueue);
    this.queues.set(QUEUE_NAMES.ATTENDANCE, this.attendanceQueue);
    this.queues.set(QUEUE_NAMES.LEAVE, this.leaveQueue);
    this.queues.set(QUEUE_NAMES.AUDIT, this.auditQueue);
    this.queues.set(QUEUE_NAMES.DEFAULT, this.defaultQueue);
  }

  /**
   * Enqueue a single job.
   *
   * @param queueName - Which queue to add the job to
   * @param jobName - The job type name (used for routing in the processor)
   * @param data - Job payload (must include tenantId)
   * @param options - BullMQ job options (priority, delay, attempts, etc.)
   * @returns The created job
   */
  async enqueue<T extends BaseJobData>(
    queueName: QueueName,
    jobName: string,
    data: T,
    options?: Partial<JobsOptions>,
  ) {
    const queue = this.getQueue(queueName);

    const job = await queue.add(jobName, data, {
      ...this.getDefaultOptions(queueName),
      ...options,
    });

    this.logger.debug(
      `Job enqueued: ${jobName} [${job.id}] → queue:${queueName}`,
      {
        jobId: job.id,
        queue: queueName,
        jobName,
        tenantId: data.tenantId,
      },
    );

    return job;
  }

  /**
   * Enqueue a job to be processed after a delay.
   *
   * @param queueName - Target queue
   * @param jobName - Job type
   * @param data - Job payload
   * @param delayMs - Delay in milliseconds before the job becomes processable
   * @param options - Additional BullMQ options
   */
  async enqueueDelayed<T extends BaseJobData>(
    queueName: QueueName,
    jobName: string,
    data: T,
    delayMs: number,
    options?: Partial<JobsOptions>,
  ) {
    return this.enqueue(queueName, jobName, data, {
      ...options,
      delay: delayMs,
    });
  }

  /**
   * Enqueue multiple jobs of the same type in bulk.
   * More efficient than enqueueing one by one.
   *
   * @param queueName - Target queue
   * @param jobName - Job type
   * @param dataItems - Array of job payloads
   * @param options - Shared options for all jobs
   */
  async enqueueBulk<T extends BaseJobData>(
    queueName: QueueName,
    jobName: string,
    dataItems: T[],
    options?: Partial<JobsOptions>,
  ) {
    if (dataItems.length === 0) return [];

    const queue = this.getQueue(queueName);
    const defaultOpts = this.getDefaultOptions(queueName);

    const jobs = dataItems.map((data) => ({
      name: jobName,
      data,
      opts: { ...defaultOpts, ...options },
    }));

    const result = await queue.addBulk(jobs);

    this.logger.debug(
      `Bulk enqueued: ${dataItems.length} ${jobName} jobs → queue:${queueName}`,
    );

    return result;
  }

  /**
   * Get the status of all queues (for monitoring).
   */
  async getQueueStatuses(): Promise<
    Record<string, { waiting: number; active: number; completed: number; failed: number; delayed: number }>
  > {
    const statuses: Record<string, any> = {};

    for (const [name, queue] of this.queues) {
      const [waiting, active, completed, failed, delayed] =
        await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
          queue.getDelayedCount(),
        ]);

      statuses[name] = { waiting, active, completed, failed, delayed };
    }

    return statuses;
  }

  /**
   * Get a queue by name. Throws if not found.
   */
  private getQueue(name: QueueName): Queue {
    const queue = this.queues.get(name);
    if (!queue) {
      throw new Error(`Queue '${name}' is not registered`);
    }
    return queue;
  }

  /**
   * Default job options per queue.
   * These can be overridden per-job when enqueueing.
   */
  private getDefaultOptions(queueName: QueueName): JobsOptions {
    const defaults: Record<QueueName, JobsOptions> = {
      [QUEUE_NAMES.NOTIFICATION]: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: { age: 604800, count: 5000 },
      },
      [QUEUE_NAMES.PAYROLL]: {
        attempts: 1, // No auto-retry for payroll — manual intervention
        removeOnComplete: { age: 604800, count: 500 },
        removeOnFail: { age: 2592000, count: 1000 }, // Keep 30 days
      },
      [QUEUE_NAMES.ATTENDANCE]: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 86400, count: 2000 },
        removeOnFail: { age: 604800, count: 5000 },
      },
      [QUEUE_NAMES.LEAVE]: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: { age: 604800, count: 2000 },
      },
      [QUEUE_NAMES.AUDIT]: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 43200, count: 5000 }, // 12 hours
        removeOnFail: { age: 604800, count: 5000 },
      },
      [QUEUE_NAMES.DEFAULT]: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: { age: 604800, count: 2000 },
      },
    };

    return defaults[queueName] || defaults[QUEUE_NAMES.DEFAULT];
  }
}
