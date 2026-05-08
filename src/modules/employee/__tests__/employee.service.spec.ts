// src/modules/employee/__tests__/employee.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { EmployeeService } from '../services/employee.service';
import { EmployeeRepository } from '../repositories/employee.repository';
import { SalaryHistoryRepository } from '../repositories/salary-history.repository';
import { DeviceService } from '../services/device.service';
import { DepartmentFacade } from '../../department/facades/department.facade';
import { EventBusService } from '../../../common/events/event-bus.service';
import { EncryptionService } from '../../../common/utils/encryption.util';
import { TenantContext } from '../../../common/context/tenant.context';
import {
  ResourceNotFoundException,
  EmployeeNumberTakenException,
  EmployeeUserAlreadyEmployedException,
  EmployeeAlreadyTerminatedException,
  EmployeeInvalidStatusTransitionException,
  OperationNotPermittedException,
} from '../../../common/exceptions/business-exceptions';
import { Employee } from '../../../database/schema/employees';
import { SalaryHistory } from '../../../database/schema/salary-history';

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────────────────────────────────────

const TENANT_ID        = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const ACTOR_ID         = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const USER_ID          = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';
const EMP_ID           = 'dddddddd-dddd-4ddd-dddd-dddddddddddd';
const DEPT_ID          = 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee';
const ENCRYPTED_SALARY = 'ENCRYPTED_BASE64_STRING';
const DECRYPTED_SALARY = '5000.00';

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: EMP_ID,
    tenantId: TENANT_ID,
    userId: USER_ID,
    employeeNumber: 'EMP-001',
    firstName: 'Alice',
    lastName: 'Smith',
    departmentId: DEPT_ID,
    position: 'Engineer',
    employmentType: 'full_time',
    baseSalaryEncrypted: ENCRYPTED_SALARY,
    salaryCurrency: 'USD',
    hireDate: '2025-01-01',
    terminationDate: null,
    timezone: null,
    locale: null,
    status: 'active',
    bankAccountEncrypted: null,
    taxIdEncrypted: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────────────────────────────

const mockEmployeeRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  findByUserId: jest.fn(),
  findByEmployeeNumber: jest.fn(),
  findMany: jest.fn(),
  update: jest.fn(),
  countActiveByDepartment: jest.fn(),
  findPayrollEligible: jest.fn(),
  reassignDepartment: jest.fn(),
};

const mockSalaryHistoryRepo = {
  create: jest.fn(),
  findByEmployee: jest.fn(),
  findLatestByEmployee: jest.fn(),
};

const mockDeviceService = {
  deactivateAllForEmployee: jest.fn().mockResolvedValue(undefined),
};

const mockDeptFacade = {
  isDepartmentValid: jest.fn(),
  clearEmployeeAsManager: jest.fn().mockResolvedValue(undefined),
};

const mockEventBus = {
  emitAsync: jest.fn().mockResolvedValue(undefined),
};

const mockEncryption = {
  encrypt: jest.fn().mockReturnValue(ENCRYPTED_SALARY),
  decrypt: jest.fn().mockReturnValue(DECRYPTED_SALARY),
};

// ─────────────────────────────────────────────────────────────────────────────
// SUITE
// ─────────────────────────────────────────────────────────────────────────────

describe('EmployeeService', () => {
  let service: EmployeeService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeService,
        { provide: EmployeeRepository,     useValue: mockEmployeeRepo },
        { provide: SalaryHistoryRepository, useValue: mockSalaryHistoryRepo },
        { provide: DeviceService,           useValue: mockDeviceService },
        { provide: DepartmentFacade,        useValue: mockDeptFacade },
        { provide: EventBusService,         useValue: mockEventBus },
        { provide: EncryptionService,       useValue: mockEncryption },
      ],
    }).compile();

    service = module.get<EmployeeService>(EmployeeService);
  });

  async function withTenant<T>(fn: () => Promise<T>): Promise<T> {
    return TenantContext.run({ tenantId: TENANT_ID }, fn);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // createEmployee
  // ───────────────────────────────────────────────────────────────────────────

  describe('createEmployee', () => {
    const validDto = {
      userId: USER_ID,
      employeeNumber: 'EMP-001',
      firstName: 'Alice',
      lastName: 'Smith',
      hireDate: '2025-01-01',
      baseSalary: 5000,
      departmentId: DEPT_ID,
    };

    it('should create an employee successfully', async () => {
      mockEmployeeRepo.findByEmployeeNumber.mockResolvedValue(null);
      mockEmployeeRepo.findByUserId.mockResolvedValue(null);
      mockDeptFacade.isDepartmentValid.mockResolvedValue(true);
      mockEmployeeRepo.create.mockResolvedValue(makeEmployee());
      mockSalaryHistoryRepo.create.mockResolvedValue({});

      const result = await withTenant(() =>
        service.createEmployee(validDto, ACTOR_ID),
      );

      expect(result.employeeNumber).toBe('EMP-001');
      expect(result.firstName).toBe('Alice');
      expect(result).not.toHaveProperty('baseSalary');
      expect(result).not.toHaveProperty('baseSalaryEncrypted');
      expect(mockEncryption.encrypt).toHaveBeenCalledWith('5000.00');
      expect(mockSalaryHistoryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ changeReason: 'initial' }),
      );
      expect(mockEventBus.emitAsync).toHaveBeenCalledTimes(1);
    });

    it('should throw EmployeeNumberTakenException when number is taken', async () => {
      mockEmployeeRepo.findByEmployeeNumber.mockResolvedValue(makeEmployee());

      await expect(
        withTenant(() => service.createEmployee(validDto, ACTOR_ID)),
      ).rejects.toThrow(EmployeeNumberTakenException);
    });

    it('should throw EmployeeUserAlreadyEmployedException when user already has profile', async () => {
      mockEmployeeRepo.findByEmployeeNumber.mockResolvedValue(null);
      mockEmployeeRepo.findByUserId.mockResolvedValue(makeEmployee());

      await expect(
        withTenant(() => service.createEmployee(validDto, ACTOR_ID)),
      ).rejects.toThrow(EmployeeUserAlreadyEmployedException);
    });

    it('should throw ResourceNotFoundException when department does not exist', async () => {
      mockEmployeeRepo.findByEmployeeNumber.mockResolvedValue(null);
      mockEmployeeRepo.findByUserId.mockResolvedValue(null);
      mockDeptFacade.isDepartmentValid.mockResolvedValue(false);

      await expect(
        withTenant(() => service.createEmployee(validDto, ACTOR_ID)),
      ).rejects.toThrow(ResourceNotFoundException);
    });

    it('should throw OperationNotPermittedException for invalid timezone', async () => {
      mockEmployeeRepo.findByEmployeeNumber.mockResolvedValue(null);
      mockEmployeeRepo.findByUserId.mockResolvedValue(null);
      mockDeptFacade.isDepartmentValid.mockResolvedValue(true);

      await expect(
        withTenant(() =>
          service.createEmployee({ ...validDto, timezone: 'Not/Real' }, ACTOR_ID),
        ),
      ).rejects.toThrow(OperationNotPermittedException);
    });

    it('should create without department when departmentId is omitted', async () => {
      const dtoNoDept = { ...validDto, departmentId: undefined };
      mockEmployeeRepo.findByEmployeeNumber.mockResolvedValue(null);
      mockEmployeeRepo.findByUserId.mockResolvedValue(null);
      mockEmployeeRepo.create.mockResolvedValue(makeEmployee({ departmentId: null }));
      mockSalaryHistoryRepo.create.mockResolvedValue({});

      const result = await withTenant(() =>
        service.createEmployee(dtoNoDept, ACTOR_ID),
      );

      expect(result.departmentId).toBeNull();
      expect(mockDeptFacade.isDepartmentValid).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // getEmployeeById
  // ───────────────────────────────────────────────────────────────────────────

  describe('getEmployeeById', () => {
    it('should return the employee DTO', async () => {
      mockEmployeeRepo.findById.mockResolvedValue(makeEmployee());
      const result = await withTenant(() => service.getEmployeeById(EMP_ID));
      expect(result.id).toBe(EMP_ID);
      expect(result.fullName).toBe('Alice Smith');
    });

    it('should throw ResourceNotFoundException when not found', async () => {
      mockEmployeeRepo.findById.mockResolvedValue(null);
      await expect(
        withTenant(() => service.getEmployeeById(EMP_ID)),
      ).rejects.toThrow(ResourceNotFoundException);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // getEmployeeSalary
  // ───────────────────────────────────────────────────────────────────────────

  describe('getEmployeeSalary', () => {
    it('should return the decrypted salary', async () => {
      mockEmployeeRepo.findById.mockResolvedValue(makeEmployee());
      const result = await withTenant(() => service.getEmployeeSalary(EMP_ID));
      expect(result.baseSalary).toBe(DECRYPTED_SALARY);
      expect(result.salaryCurrency).toBe('USD');
      expect(mockEncryption.decrypt).toHaveBeenCalledWith(ENCRYPTED_SALARY);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // updateEmployee
  // ───────────────────────────────────────────────────────────────────────────

  describe('updateEmployee', () => {
    it('should update the first name', async () => {
      const current = makeEmployee();
      const updated = makeEmployee({ firstName: 'Alicia' });
      mockEmployeeRepo.findById.mockResolvedValue(current);
      mockEmployeeRepo.update.mockResolvedValue(updated);

      const result = await withTenant(() =>
        service.updateEmployee(EMP_ID, { firstName: 'Alicia' }, ACTOR_ID),
      );

      expect(result.firstName).toBe('Alicia');
      expect(mockEventBus.emitAsync).toHaveBeenCalledTimes(1);
    });

    it('should throw EmployeeAlreadyTerminatedException for terminated employee', async () => {
      mockEmployeeRepo.findById.mockResolvedValue(makeEmployee({ status: 'terminated' }));

      await expect(
        withTenant(() =>
          service.updateEmployee(EMP_ID, { firstName: 'X' }, ACTOR_ID),
        ),
      ).rejects.toThrow(EmployeeAlreadyTerminatedException);
    });

    it('should validate new department when departmentId changes', async () => {
      mockEmployeeRepo.findById.mockResolvedValue(makeEmployee());
      mockDeptFacade.isDepartmentValid.mockResolvedValue(false);
      const newDeptId = 'ffffffff-ffff-4fff-ffff-ffffffffffff';

      await expect(
        withTenant(() =>
          service.updateEmployee(EMP_ID, { departmentId: newDeptId }, ACTOR_ID),
        ),
      ).rejects.toThrow(ResourceNotFoundException);
    });

    it('should return current state without DB write when nothing changed', async () => {
      mockEmployeeRepo.findById.mockResolvedValue(makeEmployee());
      await withTenant(() => service.updateEmployee(EMP_ID, {}, ACTOR_ID));
      expect(mockEmployeeRepo.update).not.toHaveBeenCalled();
      expect(mockEventBus.emitAsync).not.toHaveBeenCalled();
    });

    it('should allow clearing departmentId to null', async () => {
      const current = makeEmployee({ departmentId: DEPT_ID });
      const updated = makeEmployee({ departmentId: null });
      mockEmployeeRepo.findById.mockResolvedValue(current);
      mockEmployeeRepo.update.mockResolvedValue(updated);

      const result = await withTenant(() =>
        service.updateEmployee(EMP_ID, { departmentId: null }, ACTOR_ID),
      );

      expect(result.departmentId).toBeNull();
      expect(mockDeptFacade.isDepartmentValid).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // updateSelfProfile
  // ───────────────────────────────────────────────────────────────────────────

  describe('updateSelfProfile', () => {
    it('should update timezone and locale', async () => {
      const current = makeEmployee({ timezone: null, locale: null });
      const updated = makeEmployee({ timezone: 'Asia/Riyadh', locale: 'ar' });
      mockEmployeeRepo.findById.mockResolvedValue(current);
      mockEmployeeRepo.update.mockResolvedValue(updated);

      const result = await withTenant(() =>
        service.updateSelfProfile(EMP_ID, {
          timezone: 'Asia/Riyadh',
          locale: 'ar',
        }),
      );

      expect(result.timezone).toBe('Asia/Riyadh');
      expect(result.locale).toBe('ar');
      expect(mockEmployeeRepo.update).toHaveBeenCalledWith(
        EMP_ID,
        TENANT_ID,
        expect.objectContaining({ timezone: 'Asia/Riyadh', locale: 'ar' }),
      );
      expect(mockEventBus.emitAsync).toHaveBeenCalledTimes(1);
    });

    it('should allow clearing timezone to null', async () => {
      const current = makeEmployee({ timezone: 'America/New_York' });
      const updated = makeEmployee({ timezone: null });
      mockEmployeeRepo.findById.mockResolvedValue(current);
      mockEmployeeRepo.update.mockResolvedValue(updated);

      const result = await withTenant(() =>
        service.updateSelfProfile(EMP_ID, { timezone: null }),
      );

      expect(result.timezone).toBeNull();
    });

    it('should throw OperationNotPermittedException for invalid timezone', async () => {
      mockEmployeeRepo.findById.mockResolvedValue(makeEmployee());

      await expect(
        withTenant(() =>
          service.updateSelfProfile(EMP_ID, { timezone: 'Invalid/Zone' }),
        ),
      ).rejects.toThrow(OperationNotPermittedException);
    });

    it('should throw EmployeeAlreadyTerminatedException for terminated employee', async () => {
      mockEmployeeRepo.findById.mockResolvedValue(
        makeEmployee({ status: 'terminated' }),
      );

      await expect(
        withTenant(() =>
          service.updateSelfProfile(EMP_ID, { locale: 'ar' }),
        ),
      ).rejects.toThrow(EmployeeAlreadyTerminatedException);
    });

    it('should return current state without DB write when nothing changed', async () => {
      mockEmployeeRepo.findById.mockResolvedValue(
        makeEmployee({ timezone: 'UTC', locale: 'en' }),
      );

      await withTenant(() =>
        service.updateSelfProfile(EMP_ID, { timezone: 'UTC', locale: 'en' }),
      );

      // timezone and locale match current values — no update needed
      expect(mockEmployeeRepo.update).not.toHaveBeenCalled();
      expect(mockEventBus.emitAsync).not.toHaveBeenCalled();
    });

    it('should not allow updating fields outside the self-service surface', async () => {
      // UpdateSelfProfileDto only has timezone and locale — firstName is not on it.
      // This is a compile-time guarantee, but we verify the service only
      // touches those fields.
      const current = makeEmployee({ firstName: 'Alice' });
      const updated = makeEmployee({ timezone: 'UTC' });
      mockEmployeeRepo.findById.mockResolvedValue(current);
      mockEmployeeRepo.update.mockResolvedValue(updated);

      await withTenant(() =>
        service.updateSelfProfile(EMP_ID, { timezone: 'UTC' }),
      );

      // update must NOT contain firstName
      expect(mockEmployeeRepo.update).toHaveBeenCalledWith(
        EMP_ID,
        TENANT_ID,
        expect.not.objectContaining({ firstName: expect.anything() }),
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // updateSalary
  // ───────────────────────────────────────────────────────────────────────────

  describe('updateSalary', () => {
    it('should encrypt and persist the new salary', async () => {
      mockEmployeeRepo.findById.mockResolvedValue(makeEmployee());
      mockEmployeeRepo.update.mockResolvedValue(makeEmployee());
      mockSalaryHistoryRepo.create.mockResolvedValue({});

      const result = await withTenant(() =>
        service.updateSalary(
          EMP_ID,
          { baseSalary: 6000, changeReason: 'annual_review', effectiveDate: '2025-06-01' },
          ACTOR_ID,
        ),
      );

      expect(mockEncryption.encrypt).toHaveBeenCalledWith('6000.00');
      expect(mockSalaryHistoryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          changeReason: 'annual_review',
          effectiveDate: '2025-06-01',
          changedBy: ACTOR_ID,
        }),
      );
      expect(result.baseSalary).toBe('6000.00');
      expect(mockEventBus.emitAsync).toHaveBeenCalledTimes(1);
    });

    it('should throw EmployeeAlreadyTerminatedException for terminated employee', async () => {
      mockEmployeeRepo.findById.mockResolvedValue(makeEmployee({ status: 'terminated' }));

      await expect(
        withTenant(() =>
          service.updateSalary(
            EMP_ID,
            { baseSalary: 6000, changeReason: 'annual_review' },
            ACTOR_ID,
          ),
        ),
      ).rejects.toThrow(EmployeeAlreadyTerminatedException);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // changeStatus
  // ───────────────────────────────────────────────────────────────────────────

  describe('changeStatus', () => {
    it('should transition active → suspended and clear manager role', async () => {
      mockEmployeeRepo.findById.mockResolvedValue(makeEmployee({ status: 'active' }));
      mockEmployeeRepo.update.mockResolvedValue(makeEmployee({ status: 'suspended' }));

      const result = await withTenant(() =>
        service.changeStatus(EMP_ID, { status: 'suspended', reason: 'Investigation' }, ACTOR_ID),
      );

      expect(result.status).toBe('suspended');
      expect(mockDeptFacade.clearEmployeeAsManager).toHaveBeenCalledWith(EMP_ID, TENANT_ID);
      // Devices must NOT be deactivated on suspension — only on termination
      expect(mockDeviceService.deactivateAllForEmployee).not.toHaveBeenCalled();
      expect(mockEventBus.emitAsync).toHaveBeenCalledTimes(1);
    });

    it('should transition active → terminated, clear manager role AND deactivate all devices', async () => {
      mockEmployeeRepo.findById.mockResolvedValue(makeEmployee({ status: 'active' }));
      mockEmployeeRepo.update.mockResolvedValue(
        makeEmployee({ status: 'terminated', terminationDate: '2025-06-30' }),
      );

      const result = await withTenant(() =>
        service.changeStatus(
          EMP_ID,
          { status: 'terminated', terminationDate: '2025-06-30' },
          ACTOR_ID,
        ),
      );

      expect(result.status).toBe('terminated');
      expect(result.terminationDate).toBe('2025-06-30');

      // Both side effects must fire on termination
      expect(mockDeptFacade.clearEmployeeAsManager).toHaveBeenCalledWith(EMP_ID, TENANT_ID);
      expect(mockDeviceService.deactivateAllForEmployee).toHaveBeenCalledWith(EMP_ID);

      expect(mockEmployeeRepo.update).toHaveBeenCalledWith(
        EMP_ID,
        TENANT_ID,
        expect.objectContaining({ terminationDate: '2025-06-30' }),
      );
    });

    it('should transition active → on_leave without clearing manager or devices', async () => {
      mockEmployeeRepo.findById.mockResolvedValue(makeEmployee({ status: 'active' }));
      mockEmployeeRepo.update.mockResolvedValue(makeEmployee({ status: 'on_leave' }));

      await withTenant(() =>
        service.changeStatus(EMP_ID, { status: 'on_leave' }, ACTOR_ID),
      );

      expect(mockDeptFacade.clearEmployeeAsManager).not.toHaveBeenCalled();
      expect(mockDeviceService.deactivateAllForEmployee).not.toHaveBeenCalled();
    });

    it('should throw EmployeeInvalidStatusTransitionException for terminated → active', async () => {
      mockEmployeeRepo.findById.mockResolvedValue(makeEmployee({ status: 'terminated' }));

      await expect(
        withTenant(() =>
          service.changeStatus(EMP_ID, { status: 'active' }, ACTOR_ID),
        ),
      ).rejects.toThrow(EmployeeInvalidStatusTransitionException);
    });

    it('should throw EmployeeInvalidStatusTransitionException for on_leave → suspended', async () => {
      mockEmployeeRepo.findById.mockResolvedValue(makeEmployee({ status: 'on_leave' }));

      await expect(
        withTenant(() =>
          service.changeStatus(EMP_ID, { status: 'suspended' }, ACTOR_ID),
        ),
      ).rejects.toThrow(EmployeeInvalidStatusTransitionException);
    });

    it('should throw ResourceNotFoundException when employee does not exist', async () => {
      mockEmployeeRepo.findById.mockResolvedValue(null);

      await expect(
        withTenant(() =>
          service.changeStatus(EMP_ID, { status: 'suspended' }, ACTOR_ID),
        ),
      ).rejects.toThrow(ResourceNotFoundException);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // getSalaryHistory
  // ───────────────────────────────────────────────────────────────────────────

  describe('getSalaryHistory', () => {
    it('should return decrypted salary history records', async () => {
      mockEmployeeRepo.findById.mockResolvedValue(makeEmployee());

      const records: SalaryHistory[] = [
        {
          id: 'h1',
          tenantId: TENANT_ID,
          employeeId: EMP_ID,
          baseSalaryEncrypted: ENCRYPTED_SALARY,
          salaryCurrency: 'USD',
          effectiveDate: '2025-06-01',
          changeReason: 'annual_review',
          notes: null,
          changedBy: ACTOR_ID,
          createdAt: '2025-06-01',
        },
      ];
      mockSalaryHistoryRepo.findByEmployee.mockResolvedValue(records);

      const result = await withTenant(() => service.getSalaryHistory(EMP_ID));

      expect(result).toHaveLength(1);
      expect(result[0].baseSalary).toBe(DECRYPTED_SALARY);
      expect(result[0].changeReason).toBe('annual_review');
      expect(mockEncryption.decrypt).toHaveBeenCalledWith(ENCRYPTED_SALARY);
    });

    it('should throw ResourceNotFoundException when employee does not exist', async () => {
      mockEmployeeRepo.findById.mockResolvedValue(null);
      await expect(
        withTenant(() => service.getSalaryHistory(EMP_ID)),
      ).rejects.toThrow(ResourceNotFoundException);
    });
  });
});
