// src/common/events/__tests__/domain-events.spec.ts

import { EmployeeCreatedEvent } from '../domain-events/employee-created.event';
import { LeaveApprovedEvent } from '../domain-events/leave-approved.event';
import { DomainEvents } from '../event-registry';

describe('Domain Events', () => {
  describe('EmployeeCreatedEvent', () => {
    it('should carry correct event type', () => {
      const event = new EmployeeCreatedEvent(
        'tenant-1', 'admin-1', 'emp-1', 'EMP001', 'dept-1',
      );
      expect(event.eventType).toBe(DomainEvents.EMPLOYEE_CREATED);
    });

    it('should serialize payload without sensitive data', () => {
      const event = new EmployeeCreatedEvent(
        'tenant-1', 'admin-1', 'emp-1', 'EMP001', 'dept-1',
      );
      const payload = event.toPayload();

      expect(payload.employeeId).toBe('emp-1');
      expect(payload.employeeNumber).toBe('EMP001');
      expect(payload.departmentId).toBe('dept-1');
      // Should NOT contain salary, bank account, etc.
      expect(payload).not.toHaveProperty('salary');
      expect(payload).not.toHaveProperty('bankAccount');
    });
  });

  describe('LeaveApprovedEvent', () => {
    it('should carry leave details in payload', () => {
      const event = new LeaveApprovedEvent(
        'tenant-1', 'manager-1',
        'leave-1', 'emp-1', 'type-annual', 5,
        '2025-02-01', '2025-02-05',
      );

      const payload = event.toPayload();
      expect(payload.leaveRequestId).toBe('leave-1');
      expect(payload.totalDays).toBe(5);
      expect(payload.startDate).toBe('2025-02-01');
    });
  });
});

