// src/modules/department/controllers/department.controller.ts

import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Logger,
} from '@nestjs/common';
import { DepartmentService } from '../services/department.service';
import { EmployeeFacade } from '../../employee/facades/employee.facade';
import { CreateDepartmentDto } from '../dto/create-department.dto';
import { UpdateDepartmentDto } from '../dto/update-department.dto';
import { AssignManagerDto } from '../dto/assign-manager.dto';
import { DepartmentQueryDto } from '../dto/department-query.dto';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UuidValidationPipe } from '../../../common/pipes/uuid-validation.pipe';
import { createSuccessResponse } from '../../../common/types/api-response.types';
import {
  ResourceNotFoundException,
  EmployeeNotActiveException,
} from '../../../common/exceptions/business-exceptions';
import { TenantContext } from '../../../common/context/tenant.context';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

/**
 * Department management controller.
 *
 * Mounted at: /api/v1/departments
 *
 * All endpoints are tenant-scoped — the tenant ID comes from the
 * JWT/header via TenantResolverMiddleware, never from the URL.
 *
 * Permission model:
 *   GET  endpoints  → department:view
 *   POST / PUT / PATCH / DELETE → department:manage
 */
@Controller('departments')
export class DepartmentController {
  private readonly logger = new Logger(DepartmentController.name);

  constructor(
    private readonly departmentService: DepartmentService,
    private readonly employeeFacade: EmployeeFacade,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // LIST / READ
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * List departments with optional filtering and pagination.
   * GET /api/v1/departments
   */
  @Get()
  @RequirePermissions('department:view')
  async listDepartments(@Query() query: DepartmentQueryDto) {
    return this.departmentService.listDepartments(query);
  }

  /**
   * Return the full hierarchy tree.
   * GET /api/v1/departments/tree
   *
   * Note: declared before /:id to prevent Express matching "tree" as UUID.
   */
  @Get('tree')
  @RequirePermissions('department:view')
  async getDepartmentTree() {
    const tree = await this.departmentService.getDepartmentTree();
    return createSuccessResponse(tree);
  }

  /**
   * Get a single department by ID.
   * GET /api/v1/departments/:id
   */
  @Get(':id')
  @RequirePermissions('department:view')
  async getDepartment(@Param('id', UuidValidationPipe) id: string) {
    const dept = await this.departmentService.getDepartmentById(id);
    return createSuccessResponse(dept);
  }

  /**
   * Get direct children of a department.
   * GET /api/v1/departments/:id/children
   */
  @Get(':id/children')
  @RequirePermissions('department:view')
  async getChildren(@Param('id', UuidValidationPipe) id: string) {
    const children = await this.departmentService.getChildren(id);
    return createSuccessResponse(children);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a new department.
   * POST /api/v1/departments
   */
  @Post()
  @RequirePermissions('department:manage')
  async createDepartment(
    @Body() dto: CreateDepartmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const dept = await this.departmentService.createDepartment(
      dto,
      user.employeeId,
    );
    return createSuccessResponse(dept);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Update a department's name and/or parent.
   * PUT /api/v1/departments/:id
   */
  @Put(':id')
  @RequirePermissions('department:manage')
  async updateDepartment(
    @Param('id', UuidValidationPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const dept = await this.departmentService.updateDepartment(
      id,
      dto,
      user.employeeId,
    );
    return createSuccessResponse(dept);
  }

  /**
   * Assign a manager to a department.
   * PATCH /api/v1/departments/:id/manager
   *
   * Validates that the employee is active in this tenant before assigning.
   */
  @Patch(':id/manager')
  @RequirePermissions('department:manage')
  async assignManager(
    @Param('id', UuidValidationPipe) id: string,
    @Body() dto: AssignManagerDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const tenantId = TenantContext.currentTenantId;

    // Verify the proposed manager is an active employee in this tenant
    const isActive = await this.employeeFacade.isEmployeeActive(
      dto.employeeId,
      tenantId,
    );
    if (!isActive) {
      throw new EmployeeNotActiveException(dto.employeeId, 'unknown');
    }

    const dept = await this.departmentService.assignManager(
      id,
      dto,
      user.employeeId,
    );
    return createSuccessResponse(dept);
  }

  /**
   * Remove the manager from a department.
   * DELETE /api/v1/departments/:id/manager
   */
  @Delete(':id/manager')
  @RequirePermissions('department:manage')
  async removeManager(
    @Param('id', UuidValidationPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const dept = await this.departmentService.removeManager(
      id,
      user.employeeId,
    );
    return createSuccessResponse(dept);
  }

  /**
   * Deactivate a department.
   * PATCH /api/v1/departments/:id/deactivate
   *
   * Guards (checked here before delegating to the service):
   *   - Active employee count is fetched via EmployeeFacade to avoid
   *     circular module dependency inside the service layer.
   */
  @Patch(':id/deactivate')
  @RequirePermissions('department:manage')
  async deactivateDepartment(
    @Param('id', UuidValidationPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const tenantId = TenantContext.currentTenantId;

    const activeEmployeeCount =
      await this.employeeFacade.countActiveInDepartment(id, tenantId);

    const dept = await this.departmentService.deactivateDepartment(
      id,
      user.employeeId,
      activeEmployeeCount,
    );
    return createSuccessResponse(dept);
  }

  /**
   * Reactivate a previously deactivated department.
   * PATCH /api/v1/departments/:id/reactivate
   */
  @Patch(':id/reactivate')
  @RequirePermissions('department:manage')
  async reactivateDepartment(
    @Param('id', UuidValidationPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const dept = await this.departmentService.reactivateDepartment(
      id,
      user.employeeId,
    );
    return createSuccessResponse(dept);
  }
}
