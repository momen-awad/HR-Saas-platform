import { Injectable, Logger } from '@nestjs/common';
import { RoleRepository } from '../repositories/role.repository';
import { PermissionRepository } from '../repositories/permission.repository';
import { PermissionService } from './permission.service';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { RoleWithPermissions } from '../interfaces/rbac.interfaces';
import { Role } from '../../../database/schema/roles';
import { EventBusService } from '../../../common/events/event-bus.service';
import { RoleCreatedEvent } from '../events/role-created.event';
import { TenantContext } from '../../../common/context/tenant.context';
import {
  ResourceNotFoundException,
  ResourceAlreadyExistsException,
  OperationNotPermittedException,
} from '../../../common/exceptions/business-exceptions';
import { SYSTEM_ROLES, getSystemRoleBySlug } from '../constants/system-roles';

@Injectable()
export class RoleService {
  private readonly logger = new Logger(RoleService.name);

  constructor(
    private readonly roleRepo: RoleRepository,
    private readonly permissionRepo: PermissionRepository,
    private readonly permissionService: PermissionService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * List all roles for the current tenant.
   */
  async findAllForTenant(): Promise<Role[]> {
    const tenantId = TenantContext.currentTenantId;
    return this.roleRepo.findAllByTenant(tenantId);
  }

  /**
   * Get a role with its full permission list.
   */
  async findByIdWithPermissions(
    roleId: string,
  ): Promise<RoleWithPermissions> {
    const tenantId = TenantContext.currentTenantId;
    const role = await this.roleRepo.findWithPermissions(roleId, tenantId);

    if (!role) {
      throw new ResourceNotFoundException('Role', roleId);
    }

    return role;
  }

  /**
   * Create a custom role.
   */
  async createCustomRole(
    dto: CreateRoleDto,
    createdBy: string,
  ): Promise<RoleWithPermissions> {
    const tenantId = TenantContext.currentTenantId;

    // Check slug uniqueness
    const existing = await this.roleRepo.findBySlug(dto.slug, tenantId);
    if (existing) {
      throw new ResourceAlreadyExistsException('Role', 'slug', dto.slug);
    }

    // Validate permission codes
    const invalidCodes = await this.permissionService.validatePermissionCodes(
      dto.permissionCodes,
    );
    if (invalidCodes.length > 0) {
      throw new OperationNotPermittedException(
        'create_role',
        `Invalid permission codes: ${invalidCodes.join(', ')}`,
      );
    }

    // Resolve permission IDs
    const perms = await this.permissionRepo.findByCodes(dto.permissionCodes);
    const permissionIds = perms.map((p) => p.id);

    // Create role
    const role = await this.roleRepo.create({
      tenantId,
      name: dto.name,
      slug: dto.slug,
      description: dto.description || null,
      isSystem: false,
      isActive: true,
    });

    // Set permissions
    await this.roleRepo.setPermissions(role.id, permissionIds);

    // Emit event
    await this.eventBus.emitAsync(
      new RoleCreatedEvent(
        tenantId,
        createdBy,
        role.id,
        role.name,
        role.slug,
        false,
      ),
    );

    this.logger.log(
      `Custom role created: ${role.name} (${role.slug}) for tenant ${tenantId}`,
    );

    // Fetch the complete role with permissions to return
    const createdRole = await this.roleRepo.findWithPermissions(role.id, tenantId);
    if (!createdRole) {
      throw new Error('Role not found after creation');
    }
    return createdRole;
  }

  /**
   * Update a role. System roles have restrictions.
   */
  async updateRole(
    roleId: string,
    dto: UpdateRoleDto,
    updatedBy: string,
  ): Promise<RoleWithPermissions> {
    const tenantId = TenantContext.currentTenantId;

    const role = await this.roleRepo.findById(roleId, tenantId);
    if (!role) {
      throw new ResourceNotFoundException('Role', roleId);
    }

    // System role restrictions
    if (role.isSystem) {
      if (dto.name) {
        throw new OperationNotPermittedException(
          'update_role',
          'Cannot rename a system role',
        );
      }

      if (dto.permissionCodes) {
        // Ensure all default permissions are still included
        const systemDef = getSystemRoleBySlug(role.slug);
        if (systemDef) {
          const missingDefaults = systemDef.permissions.filter(
            (p) => !dto.permissionCodes!.includes(p),
          );
          if (missingDefaults.length > 0) {
            throw new OperationNotPermittedException(
              'update_role',
              `Cannot remove default permissions from system role: ${missingDefaults.join(', ')}`,
            );
          }
        }
      }
    }

    // Validate permission codes if provided
    if (dto.permissionCodes) {
      const invalidCodes =
        await this.permissionService.validatePermissionCodes(
          dto.permissionCodes,
        );
      if (invalidCodes.length > 0) {
        throw new OperationNotPermittedException(
          'update_role',
          `Invalid permission codes: ${invalidCodes.join(', ')}`,
        );
      }

      const perms = await this.permissionRepo.findByCodes(
        dto.permissionCodes,
      );
      await this.roleRepo.setPermissions(
        roleId,
        perms.map((p) => p.id),
      );
    }

    // Update role metadata
    const updateData: any = {};
    if (dto.name) updateData.name = dto.name;
    if (dto.description !== undefined)
      updateData.description = dto.description;

    if (Object.keys(updateData).length > 0) {
      await this.roleRepo.update(roleId, tenantId, updateData);
    }

    // Fetch the updated role with permissions
    const updatedRole = await this.roleRepo.findWithPermissions(roleId, tenantId);
    if (!updatedRole) {
      throw new Error('Role not found after update');
    }
    return updatedRole;
  }

  /**
   * Delete a custom role. System roles cannot be deleted.
   */
  async deleteRole(roleId: string): Promise<void> {
    const tenantId = TenantContext.currentTenantId;

    const role = await this.roleRepo.findById(roleId, tenantId);
    if (!role) {
      throw new ResourceNotFoundException('Role', roleId);
    }

    if (role.isSystem) {
      throw new OperationNotPermittedException(
        'delete_role',
        'System roles cannot be deleted',
      );
    }

    await this.roleRepo.delete(roleId, tenantId);

    this.logger.log(`Role deleted: ${role.name} (${role.slug})`);
  }

  /**
   * Seed system roles for a tenant.
   * Called during tenant onboarding.
   */
  async seedSystemRolesForTenant(tenantId: string): Promise<void> {
    this.logger.log(
      `Seeding system roles for tenant ${tenantId}...`,
    );

    for (const roleDef of SYSTEM_ROLES) {
      const existing = await this.roleRepo.findBySlug(
        roleDef.slug,
        tenantId,
      );
      if (existing) {
        this.logger.debug(
          `System role ${roleDef.slug} already exists for tenant ${tenantId}`,
        );
        continue;
      }

      // Create role
      const role = await this.roleRepo.create({
        tenantId,
        name: roleDef.name,
        slug: roleDef.slug,
        description: roleDef.description,
        isSystem: true,
        isActive: true,
      });

      // Set permissions
      const perms = await this.permissionRepo.findByCodes(
        roleDef.permissions,
      );
      await this.roleRepo.setPermissions(
        role.id,
        perms.map((p) => p.id),
      );

      this.logger.debug(
        `Seeded system role: ${roleDef.name} with ${perms.length} permissions`,
      );
    }

    this.logger.log(
      `✅ System roles seeded for tenant ${tenantId}`,
    );
  }
}
