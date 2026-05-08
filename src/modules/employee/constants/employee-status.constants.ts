// src/modules/employee/constants/employee-status.constants.ts

/**
 * Employee status lifecycle:
 *
 *   active ──→ on_probation (set at hire if probation applies)
 *   on_probation ──→ active (probation passed)
 *   active ──→ on_leave (approved leave started)
 *   on_leave ──→ active (leave ended)
 *   active ──→ suspended
 *   suspended ──→ active (suspension lifted)
 *   active | on_probation | on_leave | suspended ──→ terminated (final)
 *
 * Terminated is a terminal state — no transitions out of it.
 */
export const EmployeeStatusEnum = {
  ACTIVE: 'active',
  ON_PROBATION: 'on_probation',
  ON_LEAVE: 'on_leave',
  SUSPENDED: 'suspended',
  TERMINATED: 'terminated',
} as const;

export type EmployeeStatusType =
  (typeof EmployeeStatusEnum)[keyof typeof EmployeeStatusEnum];

/**
 * Valid status transitions.
 * Key = current status, Value = array of allowed next statuses.
 */
export const VALID_EMPLOYEE_STATUS_TRANSITIONS: Record<
  EmployeeStatusType,
  EmployeeStatusType[]
> = {
  [EmployeeStatusEnum.ACTIVE]: [
    EmployeeStatusEnum.ON_PROBATION,
    EmployeeStatusEnum.ON_LEAVE,
    EmployeeStatusEnum.SUSPENDED,
    EmployeeStatusEnum.TERMINATED,
  ],
  [EmployeeStatusEnum.ON_PROBATION]: [
    EmployeeStatusEnum.ACTIVE,
    EmployeeStatusEnum.TERMINATED,
  ],
  [EmployeeStatusEnum.ON_LEAVE]: [
    EmployeeStatusEnum.ACTIVE,
    EmployeeStatusEnum.TERMINATED,
  ],
  [EmployeeStatusEnum.SUSPENDED]: [
    EmployeeStatusEnum.ACTIVE,
    EmployeeStatusEnum.TERMINATED,
  ],
  [EmployeeStatusEnum.TERMINATED]: [],
};

export function isValidEmployeeStatusTransition(
  current: EmployeeStatusType,
  next: EmployeeStatusType,
): boolean {
  return (
    VALID_EMPLOYEE_STATUS_TRANSITIONS[current]?.includes(next) ?? false
  );
}

/**
 * Statuses that are considered "active" for payroll and attendance purposes.
 * Employees in these statuses appear in payroll runs.
 */
export const PAYROLL_ELIGIBLE_STATUSES: EmployeeStatusType[] = [
  EmployeeStatusEnum.ACTIVE,
  EmployeeStatusEnum.ON_PROBATION,
  EmployeeStatusEnum.ON_LEAVE,
];

/**
 * Employment type values.
 */
export const EmploymentTypeEnum = {
  FULL_TIME: 'full_time',
  PART_TIME: 'part_time',
  CONTRACT: 'contract',
  INTERN: 'intern',
} as const;

export type EmploymentTypeType =
  (typeof EmploymentTypeEnum)[keyof typeof EmploymentTypeEnum];
