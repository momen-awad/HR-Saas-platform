// src/modules/employee/__tests__/employee-status.spec.ts

import {
  EmployeeStatusEnum,
  VALID_EMPLOYEE_STATUS_TRANSITIONS,
  isValidEmployeeStatusTransition,
  PAYROLL_ELIGIBLE_STATUSES,
} from '../constants/employee-status.constants';

describe('Employee Status Constants', () => {
  // ── Transition validation ────────────────────────────────────────────────

  describe('isValidEmployeeStatusTransition', () => {
    const VALID_CASES: [string, string][] = [
      ['active',       'on_probation'],
      ['active',       'on_leave'],
      ['active',       'suspended'],
      ['active',       'terminated'],
      ['on_probation', 'active'],
      ['on_probation', 'terminated'],
      ['on_leave',     'active'],
      ['on_leave',     'terminated'],
      ['suspended',    'active'],
      ['suspended',    'terminated'],
    ];

    test.each(VALID_CASES)(
      '%s → %s should be valid',
      (from, to) => {
        expect(
          isValidEmployeeStatusTransition(
            from as any,
            to as any,
          ),
        ).toBe(true);
      },
    );

    const INVALID_CASES: [string, string][] = [
      ['terminated', 'active'],
      ['terminated', 'suspended'],
      ['terminated', 'on_leave'],
      ['terminated', 'on_probation'],
      ['on_leave',   'suspended'],
      ['on_leave',   'on_probation'],
      ['suspended',  'on_leave'],
      ['suspended',  'on_probation'],
    ];

    test.each(INVALID_CASES)(
      '%s → %s should be invalid',
      (from, to) => {
        expect(
          isValidEmployeeStatusTransition(
            from as any,
            to as any,
          ),
        ).toBe(false);
      },
    );

    it('terminated is a terminal state — no outbound transitions', () => {
      const outbound = VALID_EMPLOYEE_STATUS_TRANSITIONS['terminated'];
      expect(outbound).toHaveLength(0);
    });
  });

  // ── Payroll eligibility ──────────────────────────────────────────────────

  describe('PAYROLL_ELIGIBLE_STATUSES', () => {
    it('should include active, on_probation, and on_leave', () => {
      expect(PAYROLL_ELIGIBLE_STATUSES).toContain('active');
      expect(PAYROLL_ELIGIBLE_STATUSES).toContain('on_probation');
      expect(PAYROLL_ELIGIBLE_STATUSES).toContain('on_leave');
    });

    it('should NOT include suspended or terminated', () => {
      expect(PAYROLL_ELIGIBLE_STATUSES).not.toContain('suspended');
      expect(PAYROLL_ELIGIBLE_STATUSES).not.toContain('terminated');
    });
  });

  // ── Enum completeness ────────────────────────────────────────────────────

  it('every status has a transition entry in VALID_EMPLOYEE_STATUS_TRANSITIONS', () => {
    for (const status of Object.values(EmployeeStatusEnum)) {
      expect(VALID_EMPLOYEE_STATUS_TRANSITIONS).toHaveProperty(status);
    }
  });
});
