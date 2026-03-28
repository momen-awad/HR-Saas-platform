// src/modules/rbac/services/rbac.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { EmployeeRoleRepository } from '../repositories/employee-role.repository';
import { RoleRepository } from '../repositories/role.repository';
import { EventBusService } from '../../../common/events/event-bus.service';
import { RoleAssignedEvent } from '../events/role-assigned.event';
import { RoleRevokedEvent } from '../events/role-revoked.event';
import { AssignRoleDto } from '../dto/assign-role.dto';
import { RevokeRoleDto } from '../dto/revoke-role.dto';
import {
  EffectivePermissions,
  RoleSummary,
} from '../interfaces/rbac.interfaces';
import { TenantContext } from '../../../common/context/tenant.context';
import {
  ResourceNotFoundException,
  OperationNotPermittedException,
} from '../../../common/exceptions/business-exceptions';

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);

  constructor(
    private readonly employeeRoleRepo: EmployeeRoleRepository,
    private readonly roleRepo: RoleRepository,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Get the effective permissions for an employee.
   * This is the UNION of all permissions from all assigned roles.
   * Called during login to embed in JWT.
   */
  async getEffectivePermissions(
    employeeId: string,
    tenantId: string,
  ): Promise<EffectivePermissions> {
    const roles = await this.employeeRoleRepo.findRolesForEmployee(
      employeeId,
      tenantId,
    );

    const permissionCodes =
      await this.employeeRoleRepo.findPermissionCodesForEmployee(
        employeeId,
        tenantId,
      );

    return {
      employeeId,
      tenantId,
      roles,
      permissions: permissionCodes,
    };
  }

  /**
   * Check if an employee has a specific permission.
   */
  async hasPermission(
    employeeId: string,
    tenantId: string,
    permissionCode: string,
  ): Promise<boolean> {
    const effective = await this.getEffectivePermissions(
      employeeId,
      tenantId,
    );
    return effective.permissions.includes(permissionCode);
  }

  /**
   * Check if an employee has ALL of the specified permissions.
   */
  async hasAllPermissions(
    employeeId: string,
    tenantId: string,
    permissionCodes: string[],
  ): Promise<boolean> {
    const effective = await this.getEffectivePermissions(
      employeeId,
      tenantId,
    );
    return permissionCodes.every((code) =>
      effective.permissions.includes(code),
    );
  }

  /**
   * Assign roles to an employee.
   */
  async assignRoles(
    dto: AssignRoleDto,
    assignedBy: string,
  ): Promise<RoleSummary[]> {
    const tenantId = TenantContext.currentTenantId;

    // Validate all roles exist and belong to this tenant
    const roleNames: string[] = [];
    for (const roleId of dto.roleIds) {
      const role = await this.roleRepo.findById(roleId, tenantId);
      if (!role) {
        throw new ResourceNotFoundException('Role', roleId);
      }
      if (!role.isActive) {
        throw new OperationNotPermittedException(
          'assign_role',
          `Role '${role.name}' is inactive`,
        );
      }
      roleNames.push(role.name);
    }

    // Assign
    await this.employeeRoleRepo.assignRoles(
      dto.employeeId,
      tenantId,
      dto.roleIds,
      assignedBy,
    );

    // Emit event
    await this.eventBus.emitAsync(
      new RoleAssignedEvent(
        tenantId,
        assignedBy,
        dto.employeeId,
        dto.roleIds,
        roleNames,
      ),
    );

    this.logger.log(
      `Roles assigned to employee ${dto.employeeId}: ${roleNames.join(', ')}`,
    );

    return this.employeeRoleRepo.findRolesForEmployee(
      dto.employeeId,
      tenantId,
    );
  }

  /**
   * Revoke roles from an employee.
   */
  async revokeRoles(
    dto: RevokeRoleDto,
    revokedBy: string,
  ): Promise<RoleSummary[]> {
    const tenantId = TenantContext.currentTenantId;

    // Validate roles exist
    const roleNames: string[] = [];
    for (const roleId of dto.roleIds) {
      const role = await this.roleRepo.findById(roleId, tenantId);
      if (!role) {
        throw new ResourceNotFoundException('Role', roleId);
      }
      roleNames.push(role.name);
    }

    // Prevent self-lockout: don't allow revoking tenant_admin from self
    if (dto.employeeId === revokedBy) {
      for (const roleId of dto.roleIds) {
        const role = await this.roleRepo.findById(roleId, tenantId);
        if (role?.slug === 'tenant_admin') {
          throw new OperationNotPermittedException(
            'revoke_role',
            'Cannot remove the Tenant Administrator role from yourself',
          );
        }
      }
    }

    // Revoke
    await this.employeeRoleRepo.revokeRoles(
      dto.employeeId,
      tenantId,
      dto.roleIds,
    );

    // Emit event
    await this.eventBus.emitAsync(
      new RoleRevokedEvent(
        tenantId,
        revokedBy,
        dto.employeeId,
        dto.roleIds,
        roleNames,
      ),
    );

    this.logger.log(
      `Roles revoked from employee ${dto.employeeId}: ${roleNames.join(', ')}`,
    );

    return this.employeeRoleRepo.findRolesForEmployee(
      dto.employeeId,
      tenantId,
    );
  }

  /**
   * Get all roles assigned to an employee.
   */
  async getEmployeeRoles(
    employeeId: string,
  ): Promise<RoleSummary[]> {
    const tenantId = TenantContext.currentTenantId;
    return this.employeeRoleRepo.findRolesForEmployee(
      employeeId,
      tenantId,
    );
  }
}