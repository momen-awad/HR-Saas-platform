// src/modules/employee/controllers/employee.controller.ts

import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  Logger,
} from '@nestjs/common';
import { EmployeeService } from '../services/employee.service';
import { CreateEmployeeDto } from '../dto/create-employee.dto';
import { UpdateEmployeeDto } from '../dto/update-employee.dto';
import { ChangeEmployeeStatusDto } from '../dto/change-employee-status.dto';
import { UpdateSalaryDto } from '../dto/update-salary.dto';
import { EmployeeQueryDto } from '../dto/employee-query.dto';
import { RequirePermissions, RequireAnyPermission } from '../../rbac/decorators/require-permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UuidValidationPipe } from '../../../common/pipes/uuid-validation.pipe';
import { createSuccessResponse } from '../../../common/types/api-response.types';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

/**
 * Employee management controller — HR/Admin operations.
 *
 * Mounted at: /api/v1/employees
 *
 * All endpoints are tenant-scoped via TenantResolverMiddleware.
 * The tenant ID is never accepted as a URL parameter.
 *
 * Permission model:
 *   GET list / by ID   → employee:view_all
 *   POST (create)      → employee:create
 *   PUT (update)       → employee:update
 *   PATCH status       → employee:terminate (for termination) or employee:update
 *   GET/PATCH salary   → employee:manage_salary
 */
@Controller('employees')
export class EmployeeController {
  private readonly logger = new Logger(EmployeeController.name);

  constructor(private readonly employeeService: EmployeeService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // LIST / READ
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * List employees with optional filtering and pagination.
   * GET /api/v1/employees
   */
  @Get()
  @RequirePermissions('employee:view_all')
  async listEmployees(@Query() query: EmployeeQueryDto) {
    return this.employeeService.listEmployees(query);
  }

  /**
   * Get a single employee by ID.
   * GET /api/v1/employees/:id
   */
  @Get(':id')
  @RequireAnyPermission('employee:view_all', 'employee:view_team')
  async getEmployee(@Param('id', UuidValidationPipe) id: string) {
    const employee = await this.employeeService.getEmployeeById(id);
    return createSuccessResponse(employee);
  }

  /**
   * Get an employee's current salary (decrypted).
   * GET /api/v1/employees/:id/salary
   * Requires elevated salary management permission.
   */
  @Get(':id/salary')
  @RequirePermissions('employee:manage_salary')
  async getEmployeeSalary(@Param('id', UuidValidationPipe) id: string) {
    const salary = await this.employeeService.getEmployeeSalary(id);
    return createSuccessResponse(salary);
  }

  /**
   * Get the full salary history for an employee.
   * GET /api/v1/employees/:id/salary/history
   */
  @Get(':id/salary/history')
  @RequirePermissions('employee:manage_salary')
  async getSalaryHistory(@Param('id', UuidValidationPipe) id: string) {
    const history = await this.employeeService.getSalaryHistory(id);
    return createSuccessResponse(history);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a new employee profile.
   * POST /api/v1/employees
   */
  @Post()
  @RequirePermissions('employee:create')
  async createEmployee(
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const employee = await this.employeeService.createEmployee(
      dto,
      user.employeeId,
    );
    return createSuccessResponse(employee);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE — PROFILE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Update an employee's non-sensitive profile fields.
   * PUT /api/v1/employees/:id
   */
  @Put(':id')
  @RequirePermissions('employee:update')
  async updateEmployee(
    @Param('id', UuidValidationPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const employee = await this.employeeService.updateEmployee(
      id,
      dto,
      user.employeeId,
    );
    return createSuccessResponse(employee);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE — SALARY
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Update an employee's salary. Creates an immutable history record.
   * PATCH /api/v1/employees/:id/salary
   */
  @Patch(':id/salary')
  @RequirePermissions('employee:manage_salary')
  async updateSalary(
    @Param('id', UuidValidationPipe) id: string,
    @Body() dto: UpdateSalaryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const salary = await this.employeeService.updateSalary(
      id,
      dto,
      user.employeeId,
    );
    return createSuccessResponse(salary);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE — STATUS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Change an employee's status (activate, suspend, terminate, etc.).
   * PATCH /api/v1/employees/:id/status
   *
   * Uses a dedicated endpoint because status changes:
   *   - Enforce a state machine
   *   - Require a reason for auditing
   *   - Trigger side effects (manager removal, settlement payroll)
   */
  @Patch(':id/status')
  @RequireAnyPermission('employee:update', 'employee:terminate')
  async changeStatus(
    @Param('id', UuidValidationPipe) id: string,
    @Body() dto: ChangeEmployeeStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const employee = await this.employeeService.changeStatus(
      id,
      dto,
      user.employeeId,
    );
    return createSuccessResponse(employee);
  }
}
