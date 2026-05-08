// src/modules/department/__tests__/department.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentService } from '../services/department.service';
import { DepartmentRepository } from '../repositories/department.repository';
import { EventBusService } from '../../../common/events/event-bus.service';
import { TenantContext } from '../../../common/context/tenant.context';
import {
  ResourceNotFoundException,
  ResourceAlreadyExistsException,
  OperationNotPermittedException,
  DepartmentCircularReferenceException,
  DepartmentHasActiveChildrenException,
  DepartmentHasActiveEmployeesException,
} from '../../../common/exceptions/business-exceptions';
import { Department } from '../../../database/schema/departments';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const TENANT_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const ACTOR_ID  = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';

function makeDept(overrides: Partial<Department> = {}): Department {
  return {
    id: 'cccccccc-cccc-4ccc-cccc-cccccccccccc',
    tenantId: TENANT_ID,
    name: 'Engineering',
    parentId: null,
    managerEmployeeId: null,
    isActive: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────────────────────────────

const mockRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  findByName: jest.fn(),
  findMany: jest.fn(),
  findAllForTenant: jest.fn(),
  findChildren: jest.fn(),
  countActiveChildren: jest.fn(),
  findSubtreeIds: jest.fn(),
  update: jest.fn(),
  clearManager: jest.fn(),
};

const mockEventBus = {
  emitAsync: jest.fn().mockResolvedValue(undefined),
};

// ─────────────────────────────────────────────────────────────────────────────
// SUITE
// ─────────────────────────────────────────────────────────────────────────────

describe('DepartmentService', () => {
  let service: DepartmentService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentService,
        { provide: DepartmentRepository, useValue: mockRepo },
        { provide: EventBusService, useValue: mockEventBus },
      ],
    }).compile();

    service = module.get<DepartmentService>(DepartmentService);
  });

  // Helper: run code inside a real TenantContext so service calls work
  async function withTenant<T>(fn: () => Promise<T>): Promise<T> {
    return TenantContext.run({ tenantId: TENANT_ID }, fn);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // createDepartment
  // ───────────────────────────────────────────────────────────────────────────

  describe('createDepartment', () => {
    it('should create a top-level department successfully', async () => {
      mockRepo.findByName.mockResolvedValue(null);
      const dept = makeDept();
      mockRepo.create.mockResolvedValue(dept);

      const result = await withTenant(() =>
        service.createDepartment({ name: 'Engineering' }, ACTOR_ID),
      );

      expect(result.name).toBe('Engineering');
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: TENANT_ID, parentId: null }),
      );
      expect(mockEventBus.emitAsync).toHaveBeenCalledTimes(1);
    });

    it('should throw ResourceAlreadyExistsException when name is taken', async () => {
      mockRepo.findByName.mockResolvedValue(makeDept());

      await expect(
        withTenant(() =>
          service.createDepartment({ name: 'Engineering' }, ACTOR_ID),
        ),
      ).rejects.toThrow(ResourceAlreadyExistsException);
    });

    it('should throw ResourceNotFoundException when parentId does not exist', async () => {
      const parentId = 'dddddddd-dddd-4ddd-dddd-dddddddddddd';
      mockRepo.findByName.mockResolvedValue(null);
      mockRepo.findById.mockResolvedValue(null); // parent not found

      await expect(
        withTenant(() =>
          service.createDepartment({ name: 'Mobile', parentId }, ACTOR_ID),
        ),
      ).rejects.toThrow(ResourceNotFoundException);
    });

    it('should throw OperationNotPermittedException when parent is inactive', async () => {
      const parentId = 'dddddddd-dddd-4ddd-dddd-dddddddddddd';
      mockRepo.findByName.mockResolvedValue(null);
      mockRepo.findById.mockResolvedValue(makeDept({ id: parentId, isActive: false }));

      await expect(
        withTenant(() =>
          service.createDepartment({ name: 'Mobile', parentId }, ACTOR_ID),
        ),
      ).rejects.toThrow(OperationNotPermittedException);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // getDepartmentById
  // ───────────────────────────────────────────────────────────────────────────

  describe('getDepartmentById', () => {
    it('should return the department when it exists', async () => {
      mockRepo.findById.mockResolvedValue(makeDept());

      const result = await withTenant(() =>
        service.getDepartmentById('cccccccc-cccc-4ccc-cccc-cccccccccccc'),
      );

      expect(result.name).toBe('Engineering');
    });

    it('should throw ResourceNotFoundException when not found', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(
        withTenant(() =>
          service.getDepartmentById('eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee'),
        ),
      ).rejects.toThrow(ResourceNotFoundException);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // updateDepartment
  // ───────────────────────────────────────────────────────────────────────────

  describe('updateDepartment', () => {
    it('should update the department name', async () => {
      const dept = makeDept();
      mockRepo.findById.mockResolvedValue(dept);
      mockRepo.findByName.mockResolvedValue(null); // no conflict
      const updated = makeDept({ name: 'Platform Engineering' });
      mockRepo.update.mockResolvedValue(updated);

      const result = await withTenant(() =>
        service.updateDepartment(dept.id, { name: 'Platform Engineering' }, ACTOR_ID),
      );

      expect(result.name).toBe('Platform Engineering');
      expect(mockEventBus.emitAsync).toHaveBeenCalledTimes(1);
    });

    it('should throw ResourceAlreadyExistsException when new name is taken by another dept', async () => {
      const dept = makeDept();
      const conflicting = makeDept({ id: 'ffffffff-ffff-4fff-ffff-ffffffffffff', name: 'Marketing' });
      mockRepo.findById.mockResolvedValue(dept);
      mockRepo.findByName.mockResolvedValue(conflicting); // taken by another

      await expect(
        withTenant(() =>
          service.updateDepartment(dept.id, { name: 'Marketing' }, ACTOR_ID),
        ),
      ).rejects.toThrow(ResourceAlreadyExistsException);
    });

    it('should throw DepartmentCircularReferenceException when parentId equals self', async () => {
      const dept = makeDept();
      mockRepo.findById
        .mockResolvedValueOnce(dept)   // fetch self
        .mockResolvedValueOnce(dept);  // validate new parent (same dept)
      mockRepo.findSubtreeIds.mockResolvedValue([dept.id]);

      await expect(
        withTenant(() =>
          service.updateDepartment(
            dept.id,
            { parentId: dept.id },
            ACTOR_ID,
          ),
        ),
      ).rejects.toThrow(DepartmentCircularReferenceException);
    });

    it('should throw DepartmentCircularReferenceException when new parent is a descendant', async () => {
      const dept    = makeDept({ id: 'aaaaaaaa-0000-4000-0000-000000000001' });
      const childId = 'aaaaaaaa-0000-4000-0000-000000000002';
      const child   = makeDept({ id: childId, parentId: dept.id });

      mockRepo.findById
        .mockResolvedValueOnce(dept)   // fetch self
        .mockResolvedValueOnce(child); // validate new parent (child dept)
      // subtree of dept includes child
      mockRepo.findSubtreeIds.mockResolvedValue([dept.id, childId]);

      await expect(
        withTenant(() =>
          service.updateDepartment(dept.id, { parentId: childId }, ACTOR_ID),
        ),
      ).rejects.toThrow(DepartmentCircularReferenceException);
    });

    it('should return current state without DB write when nothing changed', async () => {
      const dept = makeDept({ name: 'Engineering' });
      mockRepo.findById.mockResolvedValue(dept);

      // Passing the same name — findByName should not be called because
      // the service skips the uniqueness check when name is unchanged.
      // Actually the dto.name check is `dto.name !== dept.name`, so if equal
      // it is skipped. Passing undefined means no-op.
      await withTenant(() =>
        service.updateDepartment(dept.id, {}, ACTOR_ID),
      );

      expect(mockRepo.update).not.toHaveBeenCalled();
      expect(mockEventBus.emitAsync).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // assignManager
  // ───────────────────────────────────────────────────────────────────────────

  describe('assignManager', () => {
    it('should assign a manager successfully', async () => {
      const dept     = makeDept();
      const empId    = 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee';
      const updated  = makeDept({ managerEmployeeId: empId });
      mockRepo.findById.mockResolvedValue(dept);
      mockRepo.update.mockResolvedValue(updated);

      const result = await withTenant(() =>
        service.assignManager(dept.id, { employeeId: empId }, ACTOR_ID),
      );

      expect(result.managerEmployeeId).toBe(empId);
    });

    it('should throw OperationNotPermittedException when department is inactive', async () => {
      mockRepo.findById.mockResolvedValue(makeDept({ isActive: false }));

      await expect(
        withTenant(() =>
          service.assignManager(
            'cccccccc-cccc-4ccc-cccc-cccccccccccc',
            { employeeId: 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee' },
            ACTOR_ID,
          ),
        ),
      ).rejects.toThrow(OperationNotPermittedException);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // removeManager
  // ───────────────────────────────────────────────────────────────────────────

  describe('removeManager', () => {
    it('should remove the manager', async () => {
      const empId  = 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee';
      const dept   = makeDept({ managerEmployeeId: empId });
      const updated = makeDept({ managerEmployeeId: null });
      mockRepo.findById.mockResolvedValue(dept);
      mockRepo.update.mockResolvedValue(updated);

      const result = await withTenant(() =>
        service.removeManager(dept.id, ACTOR_ID),
      );

      expect(result.managerEmployeeId).toBeNull();
    });

    it('should be idempotent when there is no manager', async () => {
      const dept = makeDept({ managerEmployeeId: null });
      mockRepo.findById.mockResolvedValue(dept);

      await withTenant(() => service.removeManager(dept.id, ACTOR_ID));

      // No update needed — already has no manager
      expect(mockRepo.update).not.toHaveBeenCalled();
      expect(mockEventBus.emitAsync).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // deactivateDepartment
  // ───────────────────────────────────────────────────────────────────────────

  describe('deactivateDepartment', () => {
    it('should deactivate a department with no children and no employees', async () => {
      const dept    = makeDept();
      const updated = makeDept({ isActive: false });
      mockRepo.findById.mockResolvedValue(dept);
      mockRepo.countActiveChildren.mockResolvedValue(0);
      mockRepo.update.mockResolvedValue(updated);

      const result = await withTenant(() =>
        service.deactivateDepartment(dept.id, ACTOR_ID, 0),
      );

      expect(result.isActive).toBe(false);
      expect(mockEventBus.emitAsync).toHaveBeenCalledTimes(1);
    });

    it('should throw OperationNotPermittedException when already inactive', async () => {
      mockRepo.findById.mockResolvedValue(makeDept({ isActive: false }));

      await expect(
        withTenant(() =>
          service.deactivateDepartment(
            'cccccccc-cccc-4ccc-cccc-cccccccccccc',
            ACTOR_ID,
          ),
        ),
      ).rejects.toThrow(OperationNotPermittedException);
    });

    it('should throw DepartmentHasActiveChildrenException when children exist', async () => {
      mockRepo.findById.mockResolvedValue(makeDept());
      mockRepo.countActiveChildren.mockResolvedValue(3);

      await expect(
        withTenant(() =>
          service.deactivateDepartment(
            'cccccccc-cccc-4ccc-cccc-cccccccccccc',
            ACTOR_ID,
            0,
          ),
        ),
      ).rejects.toThrow(DepartmentHasActiveChildrenException);
    });

    it('should throw DepartmentHasActiveEmployeesException when employees exist', async () => {
      mockRepo.findById.mockResolvedValue(makeDept());
      mockRepo.countActiveChildren.mockResolvedValue(0);

      await expect(
        withTenant(() =>
          service.deactivateDepartment(
            'cccccccc-cccc-4ccc-cccc-cccccccccccc',
            ACTOR_ID,
            5, // active employees
          ),
        ),
      ).rejects.toThrow(DepartmentHasActiveEmployeesException);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // reactivateDepartment
  // ───────────────────────────────────────────────────────────────────────────

  describe('reactivateDepartment', () => {
    it('should reactivate a top-level department', async () => {
      const dept    = makeDept({ isActive: false, parentId: null });
      const updated = makeDept({ isActive: true });
      mockRepo.findById.mockResolvedValue(dept);
      mockRepo.update.mockResolvedValue(updated);

      const result = await withTenant(() =>
        service.reactivateDepartment(dept.id, ACTOR_ID),
      );

      expect(result.isActive).toBe(true);
    });

    it('should throw OperationNotPermittedException when already active', async () => {
      mockRepo.findById.mockResolvedValue(makeDept({ isActive: true }));

      await expect(
        withTenant(() =>
          service.reactivateDepartment(
            'cccccccc-cccc-4ccc-cccc-cccccccccccc',
            ACTOR_ID,
          ),
        ),
      ).rejects.toThrow(OperationNotPermittedException);
    });

    it('should throw OperationNotPermittedException when parent is inactive', async () => {
      const parentId = 'dddddddd-dddd-4ddd-dddd-dddddddddddd';
      const dept     = makeDept({ isActive: false, parentId });
      const parent   = makeDept({ id: parentId, isActive: false });
      mockRepo.findById
        .mockResolvedValueOnce(dept)   // fetch self
        .mockResolvedValueOnce(parent); // fetch parent

      await expect(
        withTenant(() =>
          service.reactivateDepartment(dept.id, ACTOR_ID),
        ),
      ).rejects.toThrow(OperationNotPermittedException);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // getDepartmentTree
  // ───────────────────────────────────────────────────────────────────────────

  describe('getDepartmentTree', () => {
    it('should build a correctly nested tree', async () => {
      const root  = makeDept({ id: 'r', parentId: null, name: 'Root' });
      const child = makeDept({ id: 'c', parentId: 'r', name: 'Child' });
      const grand = makeDept({ id: 'g', parentId: 'c', name: 'Grandchild' });
      mockRepo.findAllForTenant.mockResolvedValue([root, child, grand]);

      const tree = await withTenant(() => service.getDepartmentTree());

      expect(tree).toHaveLength(1);
      expect(tree[0].name).toBe('Root');
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children[0].name).toBe('Child');
      expect(tree[0].children[0].children).toHaveLength(1);
      expect(tree[0].children[0].children[0].name).toBe('Grandchild');
    });

    it('should return multiple root nodes', async () => {
      const r1 = makeDept({ id: 'r1', parentId: null, name: 'Engineering' });
      const r2 = makeDept({ id: 'r2', parentId: null, name: 'Marketing' });
      mockRepo.findAllForTenant.mockResolvedValue([r1, r2]);

      const tree = await withTenant(() => service.getDepartmentTree());

      expect(tree).toHaveLength(2);
    });

    it('should return empty array when no departments exist', async () => {
      mockRepo.findAllForTenant.mockResolvedValue([]);

      const tree = await withTenant(() => service.getDepartmentTree());

      expect(tree).toHaveLength(0);
    });
  });
});
