// src/common/context/job-tenant.context.ts

import { Logger } from '@nestjs/common';
import { TenantContext } from './tenant.context';
import { RequestContext } from './request.context';
import { randomUUID } from 'crypto';

const logger = new Logger('JobTenantContext');

export interface JobContext {
  tenantId: string;
  jobName: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

export async function runJobForTenant<T>(
  context: JobContext,
  callback: () => Promise<T>,
): Promise<T> {
  const { tenantId, jobName, metadata } = context;
  const requestId = context.requestId ?? randomUUID();

  validateTenantId(tenantId, jobName);

  logger.log(
    `[JOB_START] job=${jobName} tenant=${tenantId} request=${requestId}` +
      (metadata ? ` metadata=${JSON.stringify(metadata)}` : ''),
  );

  try {
    return await TenantContext.run(
      {
        tenantId: tenantId.trim(),
        tenantStatus: 'active',
      },
      async () =>
        RequestContext.run(
          {
            requestId,
            userAgent: `BackgroundJob/${jobName}`,
            ...(metadata && { metadata }),
          },
          async () => callback(),
        ),
    );
  } catch (error) {
    logger.error(
      `[JOB_FAILED] job=${jobName} tenant=${tenantId} request=${requestId}`,
      error instanceof Error ? error.stack : error,
    );
    throw error;
  } finally {
    logger.log(
      `[JOB_END] job=${jobName} tenant=${tenantId} request=${requestId}`,
    );
  }
}

function validateTenantId(tenantId: string, jobName: string) {
  if (!tenantId || typeof tenantId !== 'string' || !tenantId.trim()) {
    const msg = `[${jobName}] tenantId is REQUIRED for background jobs`;

    logger.error(msg);
    throw new Error(msg);
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(tenantId)) {
    const msg = `[${jobName}] Invalid tenantId format`;

    logger.error(msg);
    throw new Error(msg);
  }
}

export interface TenantJobPayload {
  tenantId: string;
  jobName: string;
  requestId?: string;
  data?: Record<string, any>;
  metadata?: Record<string, any>;
  scheduledAt?: Date;
}
