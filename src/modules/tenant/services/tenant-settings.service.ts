// src/modules/tenant/services/tenant-settings.service.ts

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TenantRepository } from '../repositories/tenant.repository';
import { UpdateTenantSettingsDto } from '../dto/update-tenant-settings.dto';
import { TenantResponseDto } from '../dto/tenant-response.dto';
import { TenantSettings } from '../interfaces/tenant-settings.interface';
import { getPlanLimits } from '../constants/plan-limits.constants';

@Injectable()
export class TenantSettingsService {
  private readonly logger = new Logger(TenantSettingsService.name);

  constructor(private readonly tenantRepo: TenantRepository) {}

  /**
   * Get tenant settings.
   * Returns the resolved settings with plan-based defaults applied.
   */
  async getSettings(tenantId: string): Promise<{
    settings: TenantSettings;
    resolvedFeatures: Record<string, boolean>;
  }> {
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${tenantId}`);
    }

    const settings = (tenant.settings as TenantSettings) || {};
    const planLimits = getPlanLimits(tenant.planType);

    // Resolve features: tenant overrides > plan defaults
    const resolvedFeatures: Record<string, boolean> = {};
    for (const [key, planDefault] of Object.entries(planLimits.features)) {
      resolvedFeatures[key] =
        settings.features?.[key as keyof typeof planLimits.features] ?? planDefault;
    }

    return { settings, resolvedFeatures };
  }

  /**
   * Update tenant settings (deep merge).
   *
   * Only the provided keys are updated. Existing keys not
   * in the payload are preserved. This allows partial updates.
   */
  async updateSettings(
    tenantId: string,
    dto: UpdateTenantSettingsDto,
  ): Promise<TenantResponseDto> {
    const updated = await this.tenantRepo.updateSettings(tenantId, dto as any);
    if (!updated) {
      throw new NotFoundException(`Tenant not found: ${tenantId}`);
    }

    this.logger.log(
      `Tenant settings updated: [${tenantId}] — keys: ${Object.keys(dto).join(', ')}`,
    );

    return TenantResponseDto.fromEntity(updated);
  }
}