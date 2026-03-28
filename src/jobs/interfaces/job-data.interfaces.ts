// src/jobs/interfaces/job-data.interfaces.ts

/**
 * Type-safe job payload interfaces.
 *
 * Every job type has a corresponding data interface.
 * This ensures type safety when enqueueing and processing jobs.
 *
 * IMPORTANT: Job data is serialized to JSON and stored in Redis.
 * - Use primitive types only (string, number, boolean, arrays, objects)
 * - Do NOT include class instances, Dates (use ISO strings), or Buffers
 * - Do NOT include sensitive data (passwords, encrypted fields)
 * - Always include tenantId for tenant context setup in the worker
 */

/**
 * Base interface that ALL job data must extend.
 * Ensures every job carries tenant context.
 */
export interface BaseJobData {
  /** Tenant this job belongs to */
  tenantId: string;

  /** Who triggered this job (userId or 'system') */
  triggeredBy: string;

  /** Correlation ID for request tracing */
  correlationId?: string;
}

// ── Notification Jobs ──

export interface SendEmailJobData extends BaseJobData {
  recipientEmployeeId: string;
  templateId: string;
  templateData: Record<string, any>;
  subject: string;
}

export interface SendPushNotificationJobData extends BaseJobData {
  recipientEmployeeId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

export interface CreateInAppNotificationJobData extends BaseJobData {
  recipientEmployeeId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

// ── Payroll Jobs ──

export interface PayrollCalculationJobData extends BaseJobData {
  payrollRunId: string;
  periodYear: number;
  periodMonth: number;
}

export interface PayslipGenerationJobData extends BaseJobData {
  payrollRunId: string;
  payrollSnapshotId: string;
  employeeId: string;
}

export interface PayrollReportJobData extends BaseJobData {
  payrollRunId: string;
  reportType: 'summary' | 'tax_filing' | 'insurance';
}

// ── Attendance Jobs ──

export interface AttendanceReconciliationJobData extends BaseJobData {
  workDate: string; // ISO date string 'YYYY-MM-DD'
}

export interface AutoCheckoutJobData extends BaseJobData {
  workDate: string;
}

// ── Leave Jobs ──

export interface LeaveAccrualJobData extends BaseJobData {
  periodYear: number;
  periodMonth: number;
}

export interface LeaveExpiryJobData extends BaseJobData {
  expiryDate: string;
}

// ── Audit Jobs ──

export interface AuditLogWriteJobData extends BaseJobData {
  action: string;
  resourceType: string;
  resourceId?: string;
  actorId: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface AuditExportJobData extends BaseJobData {
  requestedBy: string;
  filters: {
    startDate: string;
    endDate: string;
    action?: string;
    resourceType?: string;
  };
  format: 'csv' | 'pdf';
}

// ── Job Name Constants ──

export const JOB_NAMES = {
  // Notification
  SEND_EMAIL: 'send-email',
  SEND_PUSH: 'send-push',
  CREATE_IN_APP_NOTIFICATION: 'create-in-app-notification',

  // Payroll
  CALCULATE_PAYROLL: 'calculate-payroll',
  GENERATE_PAYSLIP: 'generate-payslip',
  GENERATE_PAYROLL_REPORT: 'generate-payroll-report',

  // Attendance
  RECONCILE_ATTENDANCE: 'reconcile-attendance',
  AUTO_CHECKOUT: 'auto-checkout',

  // Leave
  PROCESS_LEAVE_ACCRUAL: 'process-leave-accrual',
  PROCESS_LEAVE_EXPIRY: 'process-leave-expiry',

  // Audit
  WRITE_AUDIT_LOG: 'write-audit-log',
  EXPORT_AUDIT_LOGS: 'export-audit-logs',
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];
