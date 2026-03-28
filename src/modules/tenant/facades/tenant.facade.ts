import { Injectable } from '@nestjs/common';
import { TenantRepository } from '../repositories/tenant.repository';
import { TenantSettingsService } from '../services/tenant-settings.service';
import { TenantSettings } from '../interfaces/tenant-settings.interface';
import { PlanLimits, getPlanLimits } from '../constants/plan-limits.constants';

@Injectable()
export class TenantFacade {
  private tenantCache = new Map<string, { data: any; expiresAt: number }>();
  private readonly CACHE_TTL_MS = 30_000; // 30 seconds

  constructor(
    private readonly tenantRepo: TenantRepository,
    private readonly settingsService: TenantSettingsService,
  ) {}

  async getTenantById(tenantId: string): Promise<{
    id: string;
    name: string;
    slug: string;
    planType: string;
    status: string;
    defaultTimezone: string;
    defaultLocale: string;
    maxEmployees: number | null;
  } | null> {
    const cached = this.tenantCache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) return null;

    const result = {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      planType: tenant.planType,
      status: tenant.status,
      defaultTimezone: tenant.defaultTimezone,
      defaultLocale: tenant.defaultLocale,
      maxEmployees: tenant.maxEmployees,
    };

    this.tenantCache.set(tenantId, {
      data: result,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });

    return result;
  }

  async getTenantTimezone(tenantId: string): Promise<string> {
    const tenant = await this.getTenantById(tenantId);
    return tenant?.defaultTimezone || 'UTC';
  }

  async isTenantActive(tenantId: string): Promise<boolean> {
    const tenant = await this.getTenantById(tenantId);
    return tenant?.status === 'active';
  }

  async getTenantPlanLimits(tenantId: string): Promise<PlanLimits> {
    const tenant = await this.getTenantById(tenantId);
    return getPlanLimits(tenant?.planType || 'free');
  }

  async getTenantSettings(tenantId: string): Promise<TenantSettings | null> {
    const tenant = await this.tenantRepo.findById(tenantId);
    return (tenant?.settings as TenantSettings) || null;
  }

  async isFeatureEnabled(
    tenantId: string,
    feature: string,
  ): Promise<boolean> {
    const { resolvedFeatures } = await this.settingsService.getSettings(tenantId);
    return resolvedFeatures[feature] ?? false;
  }
}
