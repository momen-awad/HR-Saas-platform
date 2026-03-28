// src/modules/rbac/rbac.module.ts

import { Module, Global } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

// Controllers
import { RoleController } from './controllers/role.controller';
import { PermissionController } from './controllers/permission.controller';

// Services
import { RbacService } from './services/rbac.service';
import { RoleService } from './services/role.service';
import { PermissionService } from './services/permission.service';
import { PermissionSeedService } from './services/permission-seed.service';

// Repositories
import { RoleRepository } from './repositories/role.repository';
import { PermissionRepository } from './repositories/permission.repository';
import { EmployeeRoleRepository } from './repositories/employee-role.repository';

// Guards
import { RbacGuard } from './guards/rbac.guard';

/**
 * RBAC Module — Role-Based Access Control.
 *
 * This module is GLOBAL because:
 * 1. RbacGuard is registered as a global guard (APP_GUARD)
 * 2. RbacService is needed by auth module for permission resolution
 * 3. PermissionSeedService runs on startup
 *
 * The RbacGuard is registered as a GLOBAL guard, meaning it runs
 * on every request. Routes without @RequirePermissions() allow any
 * authenticated user. Routes with @Public() skip auth entirely.
 */
@Global()
@Module({
  controllers: [RoleController, PermissionController],
  providers: [
    // Services
    RbacService,
    RoleService,
    PermissionService,
    PermissionSeedService,

    // Repositories
    RoleRepository,
    PermissionRepository,
    EmployeeRoleRepository,

    // Register RbacGuard as global guard
    {
      provide: APP_GUARD,
      useClass: RbacGuard,
    },
  ],
  exports: [RbacService, RoleService, PermissionService, EmployeeRoleRepository],
})
export class RbacModule {}