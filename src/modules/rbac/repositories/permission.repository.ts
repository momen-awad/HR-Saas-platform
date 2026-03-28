// src/modules/rbac/repositories/permission.repository.ts

import { Injectable, Inject } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { INJECTION_TOKENS } from '../../../common/constants/injection-tokens';
import type { DrizzleDatabase } from '../../../database/database.providers';
import {
  permissions,
  Permission,
  NewPermission,
} from '../../../database/schema/permissions';

@Injectable()
export class PermissionRepository {
  constructor(
    @Inject(INJECTION_TOKENS.DRIZZLE)
    private readonly db: DrizzleDatabase,
  ) {}

  async findAll(): Promise<Permission[]> {
    return this.db.select().from(permissions).orderBy(permissions.module, permissions.code);
  }

  async findByCode(code: string): Promise<Permission | undefined> {
    const results = await this.db
      .select()
      .from(permissions)
      .where(eq(permissions.code, code))
      .limit(1);
    return results[0];
  }

  async findByCodes(codes: string[]): Promise<Permission[]> {
    if (codes.length === 0) return [];
    return this.db
      .select()
      .from(permissions)
      .where(inArray(permissions.code, codes));
  }

  async findByModule(module: string): Promise<Permission[]> {
    return this.db
      .select()
      .from(permissions)
      .where(eq(permissions.module, module));
  }

  async upsertMany(defs: NewPermission[]): Promise<void> {
  if (defs.length === 0) return;

  for (const def of defs) {
    await this.db
      .insert(permissions)
      .values(def)
      .onConflictDoUpdate({
        target: permissions.code,
        set: {
          description: def.description,
          module: def.module,
          category: def.category,
          updatedAt: new Date(),
        },
      });
  }
}
}
