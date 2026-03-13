// src/common/types/common.types.ts

/**
 * Shared type definitions used across all modules.
 */

/**
 * Standard tenant-scoped entity fields.
 */
export interface TenantScopedEntity {
  id: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Employment status enum values.
 */
export const EmployeeStatus = {
  ACTIVE: 'active',
  ON_PROBATION: 'on_probation',
  ON_LEAVE: 'on_leave',
  SUSPENDED: 'suspended',
  TERMINATED: 'terminated',
} as const;

export type EmployeeStatusType =
  (typeof EmployeeStatus)[keyof typeof EmployeeStatus];

/**
 * Tenant status enum values.
 */
export const TenantStatus = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  TERMINATED: 'terminated',
  PENDING: 'pending',
} as const;

export type TenantStatusType =
  (typeof TenantStatus)[keyof typeof TenantStatus];

/**
 * Leave request status enum values.
 */
export const LeaveStatus = {
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  PARTIALLY_APPROVED: 'partially_approved',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  TAKEN: 'taken',
} as const;

export type LeaveStatusType =
  (typeof LeaveStatus)[keyof typeof LeaveStatus];

/**
 * Payroll run status enum values.
 */
export const PayrollRunStatus = {
  DRAFT: 'draft',
  CALCULATING: 'calculating',
  CALCULATED: 'calculated',
  REVIEW: 'review',
  APPROVED: 'approved',
  FINALIZED: 'finalized',
  PAID: 'paid',
  CANCELLED: 'cancelled',
} as const;

export type PayrollRunStatusType =
  (typeof PayrollRunStatus)[keyof typeof PayrollRunStatus];

/**
 * Attendance record status enum values.
 */
export const AttendanceStatus = {
  CHECKED_IN: 'checked_in',
  CHECKED_OUT: 'checked_out',
  AUTO_CLOSED: 'auto_closed',
  MANUALLY_CORRECTED: 'manually_corrected',
  APPROVED: 'approved',
  FLAGGED: 'flagged',
} as const;

export type AttendanceStatusType =
  (typeof AttendanceStatus)[keyof typeof AttendanceStatus];

/**
 * Plan types for tenant subscriptions.
 */
export const PlanType = {
  FREE: 'free',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const;

export type PlanTypeValue = (typeof PlanType)[keyof typeof PlanType];

