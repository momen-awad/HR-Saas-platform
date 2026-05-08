// src/modules/employee/services/employee.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { EmployeeRepository } from '../repositories/employee.repository';
import { SalaryHistoryRepository } from '../repositories/salary-history.repository';
import { DeviceService } from './device.service';
import { DepartmentFacade } from '../../department/facades/department.facade';
import { EventBusService } from '../../../common/events/event-bus.service';
import { EncryptionService } from '../../../common/utils/encryption.util';
import { TenantContext } from '../../../common/context/tenant.context';
import { DateUtil } from '../../../common/utils/date.util';
import { PaginationHelper } from '../../../common/utils/pagination.util';
import { PaginatedResult } from '../../../common/types/pagination.types';
import { CreateEmployeeDto } from '../dto/create-employee.dto';
import { UpdateEmployeeDto } from '../dto/update-employee.dto';
import { UpdateSelfProfileDto } from '../dto/update-self-profile.dto';
import { ChangeEmployeeStatusDto } from '../dto/change-employee-status.dto';
import { UpdateSalaryDto } from '../dto/update-salary.dto';
import { EmployeeQueryDto } from '../dto/employee-query.dto';
import {
  EmployeeResponseDto,
  SalaryResponseDto,
  SalaryHistoryResponseDto,
} from '../dto/employee-response.dto';
import { EmployeeCreatedEvent } from '../events/employee-created.event';
import { EmployeeUpdatedEvent } from '../events/employee-updated.event';
import { EmployeeStatusChangedEvent } from '../events/employee-status-changed.event';
import { EmployeeSalaryUpdatedEvent } from '../events/employee-salary-updated.event';
import {
  ResourceNotFoundException,
  OperationNotPermittedException,
  EmployeeAlreadyTerminatedException,
  EmployeeInvalidStatusTransitionException,
  EmployeeNumberTakenException,
  EmployeeUserAlreadyEmployedException,
} from '../../../common/exceptions/business-exceptions';
import {
  EmployeeStatusEnum,
  EmployeeStatusType,
  isValidEmployeeStatusTransition,
} from '../constants/employee-status.constants';
import { Employee } from '../../../database/schema/employees';

@Injectable()
export class EmployeeService {
  private readonly logger = new Logger(EmployeeService.name);

  constructor(
    private readonly employeeRepo: EmployeeRepository,
    private readonly salaryHistoryRepo: SalaryHistoryRepository,
    private readonly deviceService: DeviceService,
    private readonly departmentFacade: DepartmentFacade,
    private readonly eventBus: EventBusService,
    private readonly encryption: EncryptionService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────────────────

  async createEmployee(
    dto: CreateEmployeeDto,
    createdBy: string,
  ): Promise<EmployeeResponseDto> {
    const tenantId = TenantContext.currentTenantId;

    // 1. Employee number unique within the tenant
    const numberConflict = await this.employeeRepo.findByEmployeeNumber(
      dto.employeeNumber,
      tenantId,
    );
    if (numberConflict) {
      throw new EmployeeNumberTakenException(dto.employeeNumber);
    }

    // 2. One user → one employee profile per tenant
    const existingProfile = await this.employeeRepo.findByUserId(
      dto.userId,
      tenantId,
    );
    if (existingProfile) {
      throw new EmployeeUserAlreadyEmployedException(dto.userId);
    }

    // 3. Validate department if provided
    if (dto.departmentId) {
      const deptValid = await this.departmentFacade.isDepartmentValid(
        dto.departmentId,
        tenantId,
      );
      if (!deptValid) {
        throw new ResourceNotFoundException('Department', dto.departmentId);
      }
    }

    // 4. Validate timezone if provided
    if (dto.timezone && !DateUtil.isValidTimezone(dto.timezone)) {
      throw new OperationNotPermittedException(
        'create_employee',
        `Invalid timezone: '${dto.timezone}'. Use IANA timezone format (e.g., 'America/New_York').`,
      );
    }

    // 5. Encrypt sensitive fields
    const baseSalaryEncrypted = this.encryption.encrypt(
      dto.baseSalary.toFixed(2),
    )!;
    const bankAccountEncrypted = dto.bankAccount
      ? this.encryption.encrypt(dto.bankAccount)
      : null;
    const taxIdEncrypted = dto.taxId
      ? this.encryption.encrypt(dto.taxId)
      : null;

    // 6. Persist
    const employee = await this.employeeRepo.create({
      tenantId,
      userId: dto.userId,
      employeeNumber: dto.employeeNumber,
      firstName: dto.firstName,
      lastName: dto.lastName,
      departmentId: dto.departmentId ?? null,
      position: dto.position ?? null,
      employmentType: dto.employmentType ?? 'full_time',
      baseSalaryEncrypted,
      salaryCurrency: dto.salaryCurrency ?? 'USD',
      hireDate: dto.hireDate,
      terminationDate: null,
      timezone: dto.timezone ?? null,
      locale: dto.locale ?? null,
      status: EmployeeStatusEnum.ACTIVE,
      bankAccountEncrypted: bankAccountEncrypted ?? null,
      taxIdEncrypted: taxIdEncrypted ?? null,
    });

    // 7. Write initial salary history record
    await this.salaryHistoryRepo.create({
      tenantId,
      employeeId: employee.id,
      baseSalaryEncrypted,
      salaryCurrency: dto.salaryCurrency ?? 'USD',
      effectiveDate: dto.hireDate,
      changeReason: 'initial',
      notes: 'Initial salary set at hire',
      changedBy: createdBy,
    });

    this.logger.log(
      `Employee created: ${employee.firstName} ${employee.lastName} [${employee.id}] for tenant ${tenantId}`,
    );

    // 8. Emit domain event
    await this.eventBus.emitAsync(
      new EmployeeCreatedEvent(
        tenantId,
        createdBy,
        employee.id,
        employee.userId,
        employee.employeeNumber,
        employee.departmentId ?? null,
      ),
    );

    return EmployeeResponseDto.fromEntity(employee);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // READ
  // ─────────────────────────────────────────────────────────────────────────

  async getEmployeeById(id: string): Promise<EmployeeResponseDto> {
    const tenantId = TenantContext.currentTenantId;
    const employee = await this.findOrFail(id, tenantId);
    return EmployeeResponseDto.fromEntity(employee);
  }

  async listEmployees(
    query: EmployeeQueryDto,
  ): Promise<PaginatedResult<EmployeeResponseDto>> {
    const tenantId = TenantContext.currentTenantId;
    const { data, total } = await this.employeeRepo.findMany(tenantId, query);
    const dtos = data.map(EmployeeResponseDto.fromEntity);
    return PaginationHelper.createResult(dtos, total, query);
  }

  async getEmployeeSalary(id: string): Promise<SalaryResponseDto> {
    const tenantId = TenantContext.currentTenantId;
    const employee = await this.findOrFail(id, tenantId);
    const decryptedSalary = this.encryption.decrypt(
      employee.baseSalaryEncrypted,
    )!;
    return SalaryResponseDto.fromDecrypted(
      employee.id,
      decryptedSalary,
      employee.salaryCurrency,
      employee.hireDate,
    );
  }

  async getSalaryHistory(id: string): Promise<SalaryHistoryResponseDto[]> {
    const tenantId = TenantContext.currentTenantId;
    await this.findOrFail(id, tenantId);
    const records = await this.salaryHistoryRepo.findByEmployee(id, tenantId);
    return records.map((r) =>
      SalaryHistoryResponseDto.fromEntity(
        r,
        this.encryption.decrypt(r.baseSalaryEncrypted)!,
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE — PROFILE (HR/Admin)
  // ─────────────────────────────────────────────────────────────────────────

  async updateEmployee(
    id: string,
    dto: UpdateEmployeeDto,
    updatedBy: string,
  ): Promise<EmployeeResponseDto> {
    const tenantId = TenantContext.currentTenantId;
    const employee = await this.findOrFail(id, tenantId);

    if (employee.status === EmployeeStatusEnum.TERMINATED) {
      throw new EmployeeAlreadyTerminatedException(id);
    }

    const updateData: Partial<Omit<Employee, 'id' | 'tenantId'>> = {};
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    if (dto.firstName !== undefined && dto.firstName !== employee.firstName) {
      updateData.firstName = dto.firstName;
      changes.firstName = { from: employee.firstName, to: dto.firstName };
    }

    if (dto.lastName !== undefined && dto.lastName !== employee.lastName) {
      updateData.lastName = dto.lastName;
      changes.lastName = { from: employee.lastName, to: dto.lastName };
    }

    if (dto.position !== undefined && dto.position !== employee.position) {
      updateData.position = dto.position;
      changes.position = { from: employee.position, to: dto.position };
    }

    if (
      dto.employmentType !== undefined &&
      dto.employmentType !== employee.employmentType
    ) {
      updateData.employmentType = dto.employmentType;
      changes.employmentType = {
        from: employee.employmentType,
        to: dto.employmentType,
      };
    }

    if (dto.timezone !== undefined && dto.timezone !== employee.timezone) {
      if (dto.timezone !== null && !DateUtil.isValidTimezone(dto.timezone)) {
        throw new OperationNotPermittedException(
          'update_employee',
          `Invalid timezone: '${dto.timezone}'.`,
        );
      }
      updateData.timezone = dto.timezone ?? null;
      changes.timezone = { from: employee.timezone, to: dto.timezone };
    }

    if (dto.locale !== undefined && dto.locale !== employee.locale) {
      updateData.locale = dto.locale ?? null;
      changes.locale = { from: employee.locale, to: dto.locale };
    }

    if (dto.departmentId !== undefined) {
      const newDeptId = dto.departmentId ?? null;
      const oldDeptId = employee.departmentId ?? null;

      if (newDeptId !== oldDeptId) {
        if (newDeptId !== null) {
          const valid = await this.departmentFacade.isDepartmentValid(
            newDeptId,
            tenantId,
          );
          if (!valid) {
            throw new ResourceNotFoundException('Department', newDeptId);
          }
        }
        updateData.departmentId = newDeptId;
        changes.departmentId = { from: oldDeptId, to: newDeptId };
      }
    }

    if (Object.keys(updateData).length === 0) {
      return EmployeeResponseDto.fromEntity(employee);
    }

    const updated = await this.employeeRepo.update(id, tenantId, updateData);
    if (!updated) {
      throw new ResourceNotFoundException('Employee', id);
    }

    this.logger.log(`Employee updated: [${id}] for tenant ${tenantId}`);

    await this.eventBus.emitAsync(
      new EmployeeUpdatedEvent(tenantId, updatedBy, id, changes),
    );

    return EmployeeResponseDto.fromEntity(updated);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE — SELF PROFILE (Employee self-service)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Allow an employee to update only their own timezone and locale.
   *
   * This is intentionally a narrow surface — employees cannot change their
   * name, department, salary, or employment type via self-service.
   * Those require HR/admin permissions via the main employee endpoint.
   */
  async updateSelfProfile(
    employeeId: string,
    dto: UpdateSelfProfileDto,
  ): Promise<EmployeeResponseDto> {
    const tenantId = TenantContext.currentTenantId;
    const employee = await this.findOrFail(employeeId, tenantId);

    if (employee.status === EmployeeStatusEnum.TERMINATED) {
      throw new EmployeeAlreadyTerminatedException(employeeId);
    }

    const updateData: Partial<Omit<Employee, 'id' | 'tenantId'>> = {};
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    if (dto.timezone !== undefined && dto.timezone !== employee.timezone) {
      if (dto.timezone !== null && !DateUtil.isValidTimezone(dto.timezone)) {
        throw new OperationNotPermittedException(
          'update_self_profile',
          `Invalid timezone: '${dto.timezone}'. Use IANA timezone format.`,
        );
      }
      updateData.timezone = dto.timezone ?? null;
      changes.timezone = { from: employee.timezone, to: dto.timezone };
    }

    if (dto.locale !== undefined && dto.locale !== employee.locale) {
      updateData.locale = dto.locale ?? null;
      changes.locale = { from: employee.locale, to: dto.locale };
    }

    if (Object.keys(updateData).length === 0) {
      return EmployeeResponseDto.fromEntity(employee);
    }

    const updated = await this.employeeRepo.update(
      employeeId,
      tenantId,
      updateData,
    );
    if (!updated) {
      throw new ResourceNotFoundException('Employee', employeeId);
    }

    this.logger.debug(
      `Self-profile updated by employee [${employeeId}]: ${Object.keys(changes).join(', ')}`,
    );

    await this.eventBus.emitAsync(
      new EmployeeUpdatedEvent(tenantId, employeeId, employeeId, changes),
    );

    return EmployeeResponseDto.fromEntity(updated);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE — SALARY
  // ─────────────────────────────────────────────────────────────────────────

  async updateSalary(
    id: string,
    dto: UpdateSalaryDto,
    updatedBy: string,
  ): Promise<SalaryResponseDto> {
    const tenantId = TenantContext.currentTenantId;
    const employee = await this.findOrFail(id, tenantId);

    if (employee.status === EmployeeStatusEnum.TERMINATED) {
      throw new EmployeeAlreadyTerminatedException(id);
    }

    const effectiveDate =
      dto.effectiveDate ?? DateUtil.format(new Date(), 'yyyy-MM-dd');
    const newSalaryStr = dto.baseSalary.toFixed(2);
    const encryptedSalary = this.encryption.encrypt(newSalaryStr)!;
    const currency = dto.salaryCurrency ?? employee.salaryCurrency;

    await this.employeeRepo.update(id, tenantId, {
      baseSalaryEncrypted: encryptedSalary,
      salaryCurrency: currency,
    });

    await this.salaryHistoryRepo.create({
      tenantId,
      employeeId: id,
      baseSalaryEncrypted: encryptedSalary,
      salaryCurrency: currency,
      effectiveDate,
      changeReason: dto.changeReason,
      notes: dto.notes ?? null,
      changedBy: updatedBy,
    });

    this.logger.log(
      `Salary updated for employee [${id}] (reason: ${dto.changeReason})`,
    );

    await this.eventBus.emitAsync(
      new EmployeeSalaryUpdatedEvent(
        tenantId,
        updatedBy,
        id,
        dto.changeReason,
        effectiveDate,
      ),
    );

    return SalaryResponseDto.fromDecrypted(id, newSalaryStr, currency, effectiveDate);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE — STATUS
  // ─────────────────────────────────────────────────────────────────────────

  async changeStatus(
    id: string,
    dto: ChangeEmployeeStatusDto,
    updatedBy: string,
  ): Promise<EmployeeResponseDto> {
    const tenantId = TenantContext.currentTenantId;
    const employee = await this.findOrFail(id, tenantId);

    const currentStatus = employee.status as EmployeeStatusType;
    const newStatus = dto.status as EmployeeStatusType;

    if (!isValidEmployeeStatusTransition(currentStatus, newStatus)) {
      throw new EmployeeInvalidStatusTransitionException(
        id,
        currentStatus,
        newStatus,
      );
    }

    const updateData: Partial<Omit<Employee, 'id' | 'tenantId'>> = {
      status: newStatus,
    };

    const terminationDate =
      newStatus === EmployeeStatusEnum.TERMINATED
        ? (dto.terminationDate ?? DateUtil.format(new Date(), 'yyyy-MM-dd'))
        : null;

    if (terminationDate) {
      updateData.terminationDate = terminationDate;
    }

    const updated = await this.employeeRepo.update(id, tenantId, updateData);
    if (!updated) {
      throw new ResourceNotFoundException('Employee', id);
    }

    this.logger.log(
      `Employee status changed: [${id}] ${currentStatus} → ${newStatus}`,
    );

    // On termination or suspension: clear department manager assignment
    if (
      newStatus === EmployeeStatusEnum.TERMINATED ||
      newStatus === EmployeeStatusEnum.SUSPENDED
    ) {
      await this.departmentFacade.clearEmployeeAsManager(id, tenantId);
    }

    // On termination: revoke all registered mobile devices
    if (newStatus === EmployeeStatusEnum.TERMINATED) {
      await this.deviceService.deactivateAllForEmployee(id);
    }

    await this.eventBus.emitAsync(
      new EmployeeStatusChangedEvent(
        tenantId,
        updatedBy,
        id,
        currentStatus,
        newStatus,
        dto.reason ?? null,
        terminationDate,
      ),
    );

    return EmployeeResponseDto.fromEntity(updated);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  private async findOrFail(id: string, tenantId: string): Promise<Employee> {
    const employee = await this.employeeRepo.findById(id, tenantId);
    if (!employee) {
      throw new ResourceNotFoundException('Employee', id);
    }
    return employee;
  }
}
