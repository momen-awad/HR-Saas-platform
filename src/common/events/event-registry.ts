/**
 * Central registry of all domain event types in the system.
 *
 * Every event type must be registered here.
 * This serves as documentation and type-safety for event routing.
 *
 * Convention: module.action_past_tense
 *   e.g., 'attendance.checkin_recorded', 'leave.approved', 'payroll.finalized'
 */
export const DomainEvents = {
  // ── Tenant ──
  TENANT_CREATED: 'tenant.created',
  TENANT_SUSPENDED: 'tenant.suspended',
  TENANT_ACTIVATED: 'tenant.activated',

  // ── Employee ──
  EMPLOYEE_CREATED: 'employee.created',
  EMPLOYEE_UPDATED: 'employee.updated',
  EMPLOYEE_TERMINATED: 'employee.terminated',
  EMPLOYEE_SUSPENDED: 'employee.suspended',
  EMPLOYEE_ACTIVATED: 'employee.activated',

  // ── Attendance ──
  ATTENDANCE_CHECKIN_RECORDED: 'attendance.checkin_recorded',
  ATTENDANCE_CHECKOUT_RECORDED: 'attendance.checkout_recorded',
  ATTENDANCE_ANOMALY_DETECTED: 'attendance.anomaly_detected',
  ATTENDANCE_DAILY_FINALIZED: 'attendance.daily_finalized',
  ATTENDANCE_MANUALLY_CORRECTED: 'attendance.manually_corrected',

  // ── Leave ──
  LEAVE_REQUESTED: 'leave.requested',
  LEAVE_APPROVED: 'leave.approved',
  LEAVE_REJECTED: 'leave.rejected',
  LEAVE_CANCELLED: 'leave.cancelled',

  // ── Payroll ──
  PAYROLL_RUN_INITIATED: 'payroll.run_initiated',
  PAYROLL_RUN_CALCULATED: 'payroll.run_calculated',
  PAYROLL_RUN_APPROVED: 'payroll.run_approved',
  PAYROLL_RUN_FINALIZED: 'payroll.run_finalized',
  PAYROLL_PAYSLIP_GENERATED: 'payroll.payslip_generated',
  PAYROLL_SETTLEMENT_PROCESSED: 'payroll.settlement_processed',

  // ── Config ──
  POLICY_UPDATED: 'config.policy_updated',

  // ── Auth ──
  USER_LOGIN: 'auth.user_login',
  USER_LOGIN_FAILED: 'auth.user_login_failed',
  USER_PASSWORD_CHANGED: 'auth.password_changed',

  // ── RBAC ──
  RBAC_ROLE_CREATED: 'rbac.role_created',
  RBAC_ROLE_UPDATED: 'rbac.role_updated',
  RBAC_ROLE_DELETED: 'rbac.role_deleted',
  RBAC_ROLE_ASSIGNED: 'rbac.role_assigned',
  RBAC_ROLE_REVOKED: 'rbac.role_revoked',
} as const;

export type DomainEventType =
  (typeof DomainEvents)[keyof typeof DomainEvents];
