// src/modules/department/services/department.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { DepartmentRepository } from '../repositories/department.repository';
import { EventBusService } from '../../../common/events/event-bus.service';
import { TenantContext } from '../../../common/context/tenant.context';
import { PaginationHelper } from '../../../common/utils/pagination.util';
import { PaginatedResult } from '../../../common/types/pagination.types';
import { CreateDepartmentDto } from '../dto/create-department.dto';
import { UpdateDepartmentDto } from '../dto/update-department.dto';
import { AssignManagerDto } from '../dto/assign-manager.dto';
import { DepartmentQueryDto } from '../dto/department-query.dto';
import {
  DepartmentResponseDto,
  DepartmentTreeNodeDto,
} from '../dto/department-response.dto';
import { DepartmentCreatedEvent } from '../events/department-created.event';
import { DepartmentUpdatedEvent } from '../events/department-updated.event';
import { DepartmentDeactivatedEvent } from '../events/department-deactivated.event';
import {
  ResourceNotFoundException,
  ResourceAlreadyExistsException,
  OperationNotPermittedException,
  DepartmentCircularReferenceException,
  DepartmentHasActiveChildrenException,
  DepartmentHasActiveEmployeesException,
} from '../../../common/exceptions/business-exceptions';
import { Department } from '../../../database/schema/departments';

@Injectable()
export class DepartmentService {
  private readonly logger = new Logger(DepartmentService.name);

  constructor(
    private readonly departmentRepo: DepartmentRepository,
    private readonly eventBus: EventBusService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────────────────

  async createDepartment(
    dto: CreateDepartmentDto,
    createdBy: string,
  ): Promise<DepartmentResponseDto> {
    const tenantId = TenantContext.currentTenantId;

    // 1. Enforce unique name within the tenant (case-insensitive)
    const existing = await this.departmentRepo.findByName(dto.name, tenantId);
    if (existing) {
      throw new ResourceAlreadyExistsException('Department', 'name', dto.name);
    }

    // 2. Validate parent exists, belongs to this tenant, and is active
    if (dto.parentId) {
      await this.validateParentDepartment(dto.parentId, tenantId);
    }

    // 3. Persist
    const department = await this.departmentRepo.create({
      tenantId,
      name: dto.name,
      parentId: dto.parentId ?? null,
      managerEmployeeId: null,
      isActive: true,
    });

    this.logger.log(
      `Department created: "${department.name}" [${department.id}] for tenant ${tenantId}`,
    );

    // 4. Emit domain event
    await this.eventBus.emitAsync(
      new DepartmentCreatedEvent(
        tenantId,
        createdBy,
        department.id,
        department.name,
        department.parentId ?? null,
      ),
    );

    return DepartmentResponseDto.fromEntity(department);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // READ
  // ─────────────────────────────────────────────────────────────────────────

  async getDepartmentById(id: string): Promise<DepartmentResponseDto> {
    const tenantId = TenantContext.currentTenantId;

    const dept = await this.departmentRepo.findById(id, tenantId);
    if (!dept) {
      throw new ResourceNotFoundException('Department', id);
    }

    return DepartmentResponseDto.fromEntity(dept);
  }

  async listDepartments(
    query: DepartmentQueryDto,
  ): Promise<PaginatedResult<DepartmentResponseDto>> {
    const tenantId = TenantContext.currentTenantId;
    const { data, total } = await this.departmentRepo.findMany(
      tenantId,
      query,
    );
    const responseDtos = data.map(DepartmentResponseDto.fromEntity);
    return PaginationHelper.createResult(responseDtos, total, query);
  }

  /**
   * Build and return the full department hierarchy as a tree.
   *
   * Loads all departments for the tenant in a single query, then
   * assembles the tree in-memory. Efficient for typical org sizes.
   */
  async getDepartmentTree(): Promise<DepartmentTreeNodeDto[]> {
    const tenantId = TenantContext.currentTenantId;
    const all = await this.departmentRepo.findAllForTenant(tenantId);
    return this.buildTree(all, null);
  }

  /**
   * Return the immediate children of a department.
   */
  async getChildren(parentId: string): Promise<DepartmentResponseDto[]> {
    const tenantId = TenantContext.currentTenantId;

    const parent = await this.departmentRepo.findById(parentId, tenantId);
    if (!parent) {
      throw new ResourceNotFoundException('Department', parentId);
    }

    const children = await this.departmentRepo.findChildren(
      parentId,
      tenantId,
    );
    return children.map(DepartmentResponseDto.fromEntity);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────────────────────────────────

  async updateDepartment(
    id: string,
    dto: UpdateDepartmentDto,
    updatedBy: string,
  ): Promise<DepartmentResponseDto> {
    const tenantId = TenantContext.currentTenantId;

    const dept = await this.departmentRepo.findById(id, tenantId);
    if (!dept) {
      throw new ResourceNotFoundException('Department', id);
    }

    const updateData: Partial<Pick<Department, 'name' | 'parentId'>> = {};
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    // ── Name validation ────────────────────────────────────────────────────
    if (dto.name !== undefined && dto.name !== dept.name) {
      const conflict = await this.departmentRepo.findByName(
        dto.name,
        tenantId,
        id, // exclude self
      );
      if (conflict) {
        throw new ResourceAlreadyExistsException(
          'Department',
          'name',
          dto.name,
        );
      }
      updateData.name = dto.name;
      changes.name = { from: dept.name, to: dto.name };
    }

    // ── Parent validation ──────────────────────────────────────────────────
    // dto.parentId can be:
    //   undefined  → field not sent, no change
    //   null       → explicitly clear parent (promote to root)
    //   string     → change to a new parent
    if (dto.parentId !== undefined) {
      const newParentId = dto.parentId ?? null;
      const oldParentId = dept.parentId ?? null;

      if (newParentId !== oldParentId) {
        if (newParentId !== null) {
          // Validate the new parent
          await this.validateParentDepartment(newParentId, tenantId);

          // Prevent assigning self as parent
          if (newParentId === id) {
            throw new DepartmentCircularReferenceException(id, newParentId);
          }

          // Prevent circular reference: new parent must NOT be a descendant
          const subtreeIds = await this.departmentRepo.findSubtreeIds(
            id,
            tenantId,
          );
          if (subtreeIds.includes(newParentId)) {
            throw new DepartmentCircularReferenceException(id, newParentId);
          }
        }

        updateData.parentId = newParentId;
        changes.parentId = { from: oldParentId, to: newParentId };
      }
    }

    // ── Nothing changed ────────────────────────────────────────────────────
    if (Object.keys(updateData).length === 0) {
      return DepartmentResponseDto.fromEntity(dept);
    }

    const updated = await this.departmentRepo.update(id, tenantId, updateData);
    if (!updated) {
      throw new ResourceNotFoundException('Department', id);
    }

    this.logger.log(
      `Department updated: "${updated.name}" [${id}] for tenant ${tenantId}`,
    );

    await this.eventBus.emitAsync(
      new DepartmentUpdatedEvent(tenantId, updatedBy, id, changes),
    );

    return DepartmentResponseDto.fromEntity(updated);
  }

  /**
   * Assign a manager to a department.
   *
   * Full employee validation (active status, same tenant) is deferred to
   * Module 3.2 — the controller will call EmployeeFacade.isEmployeeValid()
   * before reaching this method. The service stores the reference directly.
   */
  async assignManager(
    id: string,
    dto: AssignManagerDto,
    updatedBy: string,
  ): Promise<DepartmentResponseDto> {
    const tenantId = TenantContext.currentTenantId;

    const dept = await this.departmentRepo.findById(id, tenantId);
    if (!dept) {
      throw new ResourceNotFoundException('Department', id);
    }

    if (!dept.isActive) {
      throw new OperationNotPermittedException(
        'assign_manager',
        'Cannot assign a manager to an inactive department.',
      );
    }

    const updated = await this.departmentRepo.update(id, tenantId, {
      managerEmployeeId: dto.employeeId,
    });

    if (!updated) {
      throw new ResourceNotFoundException('Department', id);
    }

    this.logger.log(
      `Manager [${dto.employeeId}] assigned to department "${dept.name}" [${id}]`,
    );

    await this.eventBus.emitAsync(
      new DepartmentUpdatedEvent(tenantId, updatedBy, id, {
        managerEmployeeId: {
          from: dept.managerEmployeeId ?? null,
          to: dto.employeeId,
        },
      }),
    );

    return DepartmentResponseDto.fromEntity(updated);
  }

  /**
   * Remove the manager assignment from a department.
   */
  async removeManager(
    id: string,
    updatedBy: string,
  ): Promise<DepartmentResponseDto> {
    const tenantId = TenantContext.currentTenantId;

    const dept = await this.departmentRepo.findById(id, tenantId);
    if (!dept) {
      throw new ResourceNotFoundException('Department', id);
    }

    if (!dept.managerEmployeeId) {
      // Idempotent — no manager to remove, return current state
      return DepartmentResponseDto.fromEntity(dept);
    }

    const updated = await this.departmentRepo.update(id, tenantId, {
      managerEmployeeId: null,
    });

    if (!updated) {
      throw new ResourceNotFoundException('Department', id);
    }

    this.logger.log(
      `Manager removed from department "${dept.name}" [${id}]`,
    );

    await this.eventBus.emitAsync(
      new DepartmentUpdatedEvent(tenantId, updatedBy, id, {
        managerEmployeeId: {
          from: dept.managerEmployeeId,
          to: null,
        },
      }),
    );

    return DepartmentResponseDto.fromEntity(updated);
  }

  /**
   * Deactivate a department (soft delete).
   *
   * Guards (in order):
   *   1. Department must currently be active
   *   2. No active direct children
   *   3. No active employees assigned (caller supplies the count from
   *      EmployeeFacade — defaults to 0 until Module 3.2 is wired in)
   *
   * On deactivation the manager assignment is cleared automatically
   * since an inactive department needs no manager reference.
   */
  async deactivateDepartment(
    id: string,
    updatedBy: string,
    activeEmployeeCount: number = 0,
  ): Promise<DepartmentResponseDto> {
    const tenantId = TenantContext.currentTenantId;

    const dept = await this.departmentRepo.findById(id, tenantId);
    if (!dept) {
      throw new ResourceNotFoundException('Department', id);
    }

    if (!dept.isActive) {
      throw new OperationNotPermittedException(
        'deactivate_department',
        'Department is already inactive.',
      );
    }

    const activeChildCount = await this.departmentRepo.countActiveChildren(
      id,
      tenantId,
    );
    if (activeChildCount > 0) {
      throw new DepartmentHasActiveChildrenException(id, activeChildCount);
    }

    if (activeEmployeeCount > 0) {
      throw new DepartmentHasActiveEmployeesException(id, activeEmployeeCount);
    }

    const updated = await this.departmentRepo.update(id, tenantId, {
      isActive: false,
      managerEmployeeId: null,
    });

    if (!updated) {
      throw new ResourceNotFoundException('Department', id);
    }

    this.logger.log(
      `Department deactivated: "${dept.name}" [${id}] for tenant ${tenantId}`,
    );

    await this.eventBus.emitAsync(
      new DepartmentDeactivatedEvent(tenantId, updatedBy, id, dept.name),
    );

    return DepartmentResponseDto.fromEntity(updated);
  }

  /**
   * Reactivate a previously deactivated department.
   * The parent (if any) must still be active.
   */
  async reactivateDepartment(
    id: string,
    updatedBy: string,
  ): Promise<DepartmentResponseDto> {
    const tenantId = TenantContext.currentTenantId;

    const dept = await this.departmentRepo.findById(id, tenantId);
    if (!dept) {
      throw new ResourceNotFoundException('Department', id);
    }

    if (dept.isActive) {
      throw new OperationNotPermittedException(
        'reactivate_department',
        'Department is already active.',
      );
    }

    if (dept.parentId) {
      const parent = await this.departmentRepo.findById(
        dept.parentId,
        tenantId,
      );
      if (!parent || !parent.isActive) {
        throw new OperationNotPermittedException(
          'reactivate_department',
          'Cannot reactivate a department whose parent is inactive. Reactivate the parent first.',
        );
      }
    }

    const updated = await this.departmentRepo.update(id, tenantId, {
      isActive: true,
    });

    if (!updated) {
      throw new ResourceNotFoundException('Department', id);
    }

    this.logger.log(
      `Department reactivated: "${dept.name}" [${id}] for tenant ${tenantId}`,
    );

    await this.eventBus.emitAsync(
      new DepartmentUpdatedEvent(tenantId, updatedBy, id, {
        isActive: { from: false, to: true },
      }),
    );

    return DepartmentResponseDto.fromEntity(updated);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Validate that a department can be used as a parent:
   *   - must exist in this tenant
   *   - must be active
   *
   * Throws typed exceptions so callers do not need to repeat this logic.
   */
  private async validateParentDepartment(
    parentId: string,
    tenantId: string,
  ): Promise<void> {
    const parent = await this.departmentRepo.findById(parentId, tenantId);
    if (!parent) {
      throw new ResourceNotFoundException('Department (parent)', parentId);
    }
    if (!parent.isActive) {
      throw new OperationNotPermittedException(
        'set_parent_department',
        'Cannot assign an inactive department as parent.',
      );
    }
  }

  /**
   * Build a nested DepartmentTreeNodeDto list from a flat array.
   * Recursive — each call collects nodes whose parentId matches the
   * supplied value then recurses for their children.
   */
  private buildTree(
    all: Department[],
    parentId: string | null,
  ): DepartmentTreeNodeDto[] {
    return all
      .filter((d) => (d.parentId ?? null) === parentId)
      .map((d) =>
        DepartmentTreeNodeDto.fromEntity(d, this.buildTree(all, d.id)),
      );
  }
}
