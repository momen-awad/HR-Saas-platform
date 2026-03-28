// src/modules/tenant/constants/tenant-status.constants.ts

/**
 * Tenant status lifecycle:
 *
 *   pending ──→ active ──→ suspended ──→ active (reactivation)
 *                  │                        │
 *                  └──→ terminated ←────────┘
 *
 * - pending: Just created, awaiting activation (e.g., payment confirmation)
 * - active: Fully operational
 * - suspended: Temporarily disabled (non-payment, TOS violation)
 * - terminated: Permanently disabled (data retained for compliance)
 */
export const TenantStatusEnum = {
  PENDING: 'pending',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  TERMINATED: 'terminated',
} as const;

export type TenantStatusType = (typeof TenantStatusEnum)[keyof typeof TenantStatusEnum];

/**
 * Valid status transitions.
 * Key = current status, Value = array of valid next statuses.
 */
export const VALID_STATUS_TRANSITIONS: Record<TenantStatusType, TenantStatusType[]> = {
  [TenantStatusEnum.PENDING]: [TenantStatusEnum.ACTIVE, TenantStatusEnum.TERMINATED],
  [TenantStatusEnum.ACTIVE]: [TenantStatusEnum.SUSPENDED, TenantStatusEnum.TERMINATED],
  [TenantStatusEnum.SUSPENDED]: [TenantStatusEnum.ACTIVE, TenantStatusEnum.TERMINATED],
  [TenantStatusEnum.TERMINATED]: [], // Terminal state — no transitions allowed
};

/**
 * Check if a status transition is valid.
 */
export function isValidStatusTransition(
  currentStatus: TenantStatusType,
  newStatus: TenantStatusType,
): boolean {
  return VALID_STATUS_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}