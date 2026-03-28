// src/modules/tenant/repositories/tenant.repository.ts

import { Injectable, Inject } from '@nestjs/common';
import {
  eq,
  and,
  or,
  ilike,
  sql,
  desc,
  asc,
  SQL,
  count,
} from 'drizzle-orm';
import { INJECTION_TOKENS }  from '../../../common/constants/injection-tokens';
import type { DrizzleDatabase }   from '../../../database/database.providers';
import { tenants, Tenant, NewTenant } from '../../../database/schema';
import { TenantQueryDto }    from '../dto/tenant-query.dto';
import { PaginationHelper }  from '../../../common/utils/pagination.util';

/**
 * TenantRepository — كل الـ database access للـ tenants table.
 *
 * الـ tenants table مفيش عليها RLS لأن:
 * 1. هي نفسها الـ tenant — هي الـ root entity
 * 2. الـ super admins محتاجين يقروا كل الـ tenants
 * 3. الـ TenantResolverMiddleware بيقرأ الجدول ده قبل ما الـ RLS context يتحط
 *
 * التحكم في الوصول بيتعمل على مستوى الـ service/controller:
 * - الـ super admins يقدروا يقروا/يكتبوا أي tenant
 * - الـ tenant admins يقدروا يقروا/يحدّثوا الـ tenant بتاعهم بس
 */
@Injectable()
export class TenantRepository {
  constructor(
    @Inject(INJECTION_TOKENS.DRIZZLE)
    private readonly db: DrizzleDatabase,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────────────────

  async create(data: NewTenant): Promise<Tenant> {
    const [tenant] = await this.db
      .insert(tenants)
      .values(data)
      .returning();

    return tenant;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // READ
  // ─────────────────────────────────────────────────────────────────────────

  async findById(id: string): Promise<Tenant | null> {
    const [tenant] = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);

    return tenant ?? null;
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    const [tenant] = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);

    return tenant ?? null;
  }

  async isSlugTaken(slug: string, excludeId?: string): Promise<boolean> {
    const conditions: SQL[] = [eq(tenants.slug, slug)];

    if (excludeId) {
      conditions.push(sql`${tenants.id} != ${excludeId}`);
    }

    const [result] = await this.db
      .select({ count: count() })
      .from(tenants)
      .where(and(...conditions));

    // ── الإصلاح: Number() عشان PostgreSQL ممكن يرجع string ────────────────
    return Number(result?.count ?? 0) > 0;
  }

  /**
   * قائمة الـ tenants مع pagination وffiltering.
   */
  async findMany(
    query: TenantQueryDto,
  ): Promise<{ data: Tenant[]; total: number }> {
    const { perPage, offset } = PaginationHelper.parse(query);

    // ── بناء الـ WHERE conditions ──────────────────────────────────────────
    const conditions: SQL[] = [];

    if (query.status) {
      conditions.push(eq(tenants.status, query.status));
    }

    if (query.planType) {
      conditions.push(eq(tenants.planType, query.planType));
    }

    if (query.search) {
      // ── الإصلاح: sanitize الـ LIKE special characters ──────────────────
      // الـ % و _ ليهم معنى خاص في LIKE patterns
      // بدون sanitization: search = "%adm%" يرجع كل الـ tenants
      const sanitized = query.search
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');

      conditions.push(
        or(
          ilike(tenants.name, `%${sanitized}%`),
          ilike(tenants.slug, `%${sanitized}%`),
        )!,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // ── بناء الـ ORDER BY ──────────────────────────────────────────────────
    const sortField =
      query.sortBy === 'name'      ? tenants.name      :
      query.sortBy === 'createdAt' ? tenants.createdAt :
      query.sortBy === 'status'    ? tenants.status    :
      tenants.createdAt; // default

    const sortDir = query.sortDirection === 'asc' ? asc : desc;

    // ── تنفيذ count + data بالتوازي ───────────────────────────────────────
    const [countResult, data] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(tenants)
        .where(whereClause),
      this.db
        .select()
        .from(tenants)
        .where(whereClause)
        .orderBy(sortDir(sortField))
        .limit(perPage)
        .offset(offset),
    ]);

    // ── الإصلاح: Number() عشان PostgreSQL ممكن يرجع string ────────────────
    const total = Number(countResult[0]?.count ?? 0);

    return { data, total };
  }

  /**
   * إيجاد كل الـ active tenants مع الـ timezones.
   * بيستخدمها الـ cron tasks لتحديد الـ timezone-based scheduling.
   */
  async findActiveTenantsWithTimezones(): Promise<
    Array<{ id: string; defaultTimezone: string }>
  > {
    return this.db
      .select({
        id:               tenants.id,
        defaultTimezone:  tenants.defaultTimezone,
      })
      .from(tenants)
      .where(eq(tenants.status, 'active'));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────────────────────────────────

  async update(id: string, data: Partial<NewTenant>): Promise<Tenant | null> {
    const [updated] = await this.db
      .update(tenants)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();

    return updated ?? null;
  }

  async updateStatus(id: string, status: string): Promise<Tenant | null> {
    return this.update(id, { status });
  }

  /**
   * تحديث الـ settings (deep merge).
   * بس المفاتيح المقدّمة بتتحدث — المفاتيح الموجودة اللي مش في الـ payload بتتحفظ.
   */
  async updateSettings(
    id: string,
    settings: Record<string, any>,
  ): Promise<Tenant | null> {
    const tenant = await this.findById(id);
    if (!tenant) return null;

    const currentSettings = (tenant.settings as Record<string, any>) || {};
    const mergedSettings  = deepMerge(currentSettings, settings);

    return this.update(id, { settings: mergedSettings });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deep merge لـ object اتنين (بيستخدم لـ JSONB settings merge).
 * الـ arrays بتتستبدل مش بتتدمج.
 */
function deepMerge(
  target: Record<string, any>,
  source: Record<string, any>,
): Record<string, any> {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = target[key];

    if (
      sourceVal !== null &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      targetVal !== null &&
      typeof targetVal === 'object' &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(targetVal, sourceVal);
    } else {
      result[key] = sourceVal;
    }
  }

  return result;
}
