import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { JobSchedulerService } from '../jobs/job-scheduler.service';
import { QUEUE_NAMES } from '../jobs/queue-names';
import { JOB_NAMES } from '../jobs/interfaces/job-data.interfaces';
import { Inject } from '@nestjs/common';
import { INJECTION_TOKENS } from '../common/constants/injection-tokens';
import type { DrizzleDatabase } from '../database/database.providers';
import { tenants } from '../database/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class CronTasksService {
  private readonly logger = new Logger(CronTasksService.name);

  constructor(
    private readonly jobScheduler: JobSchedulerService,
    @Inject(INJECTION_TOKENS.DRIZZLE)
    private readonly db: DrizzleDatabase,
  ) {}

  @Cron('5 * * * *')
  async scheduleAutoCheckout() {
    this.logger.debug('Cron: Checking for auto-checkout eligible tenants');

    try {
      const activeTenants = await this.db
        .select({
          id: tenants.id,
          defaultTimezone: tenants.defaultTimezone,
        })
        .from(tenants)
        .where(eq(tenants.status, 'active'));

      const now = new Date();

      for (const tenant of activeTenants) {
        const tenantHour = this.getHourInTimezone(now, tenant.defaultTimezone);

        if (tenantHour === 0) {
          const yesterday = this.getYesterdayDateString(tenant.defaultTimezone);

          await this.jobScheduler.enqueue(
            QUEUE_NAMES.ATTENDANCE,
            JOB_NAMES.AUTO_CHECKOUT,
            {
              tenantId: tenant.id,
              triggeredBy: 'system',
              workDate: yesterday,
            },
          );

          this.logger.log(
            `Auto-checkout job enqueued for tenant ${tenant.id} (${tenant.defaultTimezone}), date: ${yesterday}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Cron auto-checkout failed: ${error.message}`,
        error.stack,
      );
    }
  }

  @Cron('0 2 * * *')
  async scheduleDailyReconciliation() {
    this.logger.log('Cron: Scheduling daily attendance reconciliation');

    try {
      const activeTenants = await this.db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.status, 'active'));

      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      const jobDataItems = activeTenants.map((tenant) => ({
        tenantId: tenant.id,
        triggeredBy: 'system',
        workDate: dateStr,
      }));

      await this.jobScheduler.enqueueBulk(
        QUEUE_NAMES.ATTENDANCE,
        JOB_NAMES.RECONCILE_ATTENDANCE,
        jobDataItems,
      );

      this.logger.log(
        `Daily reconciliation: ${activeTenants.length} tenant jobs enqueued`,
      );
    } catch (error) {
      this.logger.error(
        `Cron daily reconciliation failed: ${error.message}`,
        error.stack,
      );
    }
  }

  @Cron('0 3 1 * *')
  async scheduleMonthlyLeaveAccrual() {
    this.logger.log('Cron: Scheduling monthly leave accrual');

    try {
      const activeTenants = await this.db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.status, 'active'));

      const now = new Date();

      const jobDataItems = activeTenants.map((tenant) => ({
        tenantId: tenant.id,
        triggeredBy: 'system',
        periodYear: now.getUTCFullYear(),
        periodMonth: now.getUTCMonth() + 1,
      }));

      await this.jobScheduler.enqueueBulk(
        QUEUE_NAMES.LEAVE,
        JOB_NAMES.PROCESS_LEAVE_ACCRUAL,
        jobDataItems,
      );

      this.logger.log(
        `Monthly leave accrual: ${activeTenants.length} tenant jobs enqueued`,
      );
    } catch (error) {
      this.logger.error(
        `Cron leave accrual failed: ${error.message}`,
        error.stack,
      );
    }
  }

  private getHourInTimezone(date: Date, timezone: string): number {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false,
      });
      return parseInt(formatter.format(date), 10);
    } catch {
      return -1;
    }
  }

  private getYesterdayDateString(timezone: string): string {
    const now = new Date();

    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);

    const year = parseInt(parts.find(p => p.type === 'year')!.value, 10);
    const month = parseInt(parts.find(p => p.type === 'month')!.value, 10);
    const day = parseInt(parts.find(p => p.type === 'day')!.value, 10);

    const today = new Date(Date.UTC(year, month - 1, day));
    today.setUTCDate(today.getUTCDate() - 1);

    return today.toISOString().split('T')[0];
  }
}
