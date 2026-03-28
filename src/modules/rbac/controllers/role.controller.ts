// src/modules/rbac/controllers/role.controller.ts

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RoleService } from '../services/role.service';
import { RbacService } from '../services/rbac.service';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { AssignRoleDto } from '../dto/assign-role.dto';
import { RevokeRoleDto } from '../dto/revoke-role.dto';
import {
  RequirePermissions,
} from '../decorators/require-permissions.decorator';
import { UuidValidationPipe } from '../../../common/pipes/uuid-validation.pipe';
import { createSuccessResponse } from '../../../common/types/api-response.types';

@Controller('roles')
export class RoleController {
  private readonly logger = new Logger(RoleController.name);

  constructor(
    private readonly roleService: RoleService,
    private readonly rbacService: RbacService,
  ) {}

  @Get()
  @RequirePermissions('rbac:view_roles')
  async listRoles() {
    const roles = await this.roleService.findAllForTenant();
    return createSuccessResponse(roles);
  }

  @Get(':id')
  @RequirePermissions('rbac:view_roles')
  async getRole(@Param('id', UuidValidationPipe) id: string) {
    const role = await this.roleService.findByIdWithPermissions(id);
    return createSuccessResponse(role);
  }

  @Post()
  @RequirePermissions('rbac:manage_roles')
  async createRole(@Body() dto: CreateRoleDto) {
    // TODO: Extract actual user ID from auth context (Module 2.2)
    const createdBy = 'system';
    const role = await this.roleService.createCustomRole(dto, createdBy);
    return createSuccessResponse(role);
  }

  @Put(':id')
  @RequirePermissions('rbac:manage_roles')
  async updateRole(
    @Param('id', UuidValidationPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    const updatedBy = 'system';
    const role = await this.roleService.updateRole(id, dto, updatedBy);
    return createSuccessResponse(role);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('rbac:manage_roles')
  async deleteRole(@Param('id', UuidValidationPipe) id: string) {
    await this.roleService.deleteRole(id);
  }

  // ── Employee Role Assignment ──

  @Get('employees/:employeeId/roles')
  @RequirePermissions('rbac:view_roles')
  async getEmployeeRoles(
    @Param('employeeId', UuidValidationPipe) employeeId: string,
  ) {
    const roles = await this.rbacService.getEmployeeRoles(employeeId);
    return createSuccessResponse(roles);
  }

  @Post('assign')
  @RequirePermissions('rbac:assign_roles')
  async assignRoles(@Body() dto: AssignRoleDto) {
    const assignedBy = 'system';
    const roles = await this.rbacService.assignRoles(dto, assignedBy);
    return createSuccessResponse(roles);
  }

  @Post('revoke')
  @RequirePermissions('rbac:assign_roles')
  async revokeRoles(@Body() dto: RevokeRoleDto) {
    const revokedBy = 'system';
    const roles = await this.rbacService.revokeRoles(dto, revokedBy);
    return createSuccessResponse(roles);
  }
}