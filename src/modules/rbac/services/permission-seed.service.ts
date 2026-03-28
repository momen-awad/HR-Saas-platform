// src/modules/rbac/services/permission-seed.service.ts

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PermissionRepository } from '../repositories/permission.repository';
import {
  SYSTEM_PERMISSIONS,
  PermissionDefinition,
} from '../constants/system-permissions';
import { NewPermission } from '../../../database/schema/permissions';

/**
 * Seeds system permissions into the database on application startup.
 * Permissions are idempotent — running this multiple times is safe.
 * New permissions are added, existing ones have their metadata updated,
 * no permissions are removed (to avoid breaking existing role assignments).
 */
@Injectable()
export class PermissionSeedService implements OnModuleInit {
  private readonly logger = new Logger(PermissionSeedService.name);

  constructor(private readonly permissionRepo: PermissionRepository) {}

  async onModuleInit(): Promise<void> {
    await this.seed();
  }

  async seed(): Promise<void> {
    this.logger.log(
      `Seeding ${SYSTEM_PERMISSIONS.length} system permissions...`,
    );

    const records: NewPermission[] = SYSTEM_PERMISSIONS.map((def) => ({
      code: def.code,
      description: def.description,
      module: def.module,
      category: def.category,
    }));

    await this.permissionRepo.upsertMany(records);

    this.logger.log(
      `✅ System permissions seeded (${SYSTEM_PERMISSIONS.length} total)`,
    );
  }
}