// src/modules/rbac/controllers/permission.controller.ts

import { Controller, Get, Query, Logger } from '@nestjs/common';
import { PermissionService } from '../services/permission.service';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { createSuccessResponse } from '../../../common/types/api-response.types';

@Controller('permissions')
export class PermissionController {
  private readonly logger = new Logger(PermissionController.name);

  constructor(private readonly permissionService: PermissionService) {}

  /**
   * List all system permissions.
   * Used by the UI to display permission checkboxes when creating/editing roles.
   */
  @Get()
  @RequirePermissions('rbac:view_roles')
  async listPermissions(@Query('module') module?: string) {
    const perms = module
      ? await this.permissionService.findByModule(module)
      : await this.permissionService.findAll();

    // Group by module for UI convenience
    const grouped = perms.reduce(
      (acc, perm) => {
        const mod = perm.module;
        if (!acc[mod]) acc[mod] = [];
        acc[mod].push({
          id: perm.id,
          code: perm.code,
          description: perm.description,
          category: perm.category,
        });
        return acc;
      },
      {} as Record<string, any[]>,
    );

    return createSuccessResponse({
      permissions: perms,
      grouped,
      total: perms.length,
    });
  }
}