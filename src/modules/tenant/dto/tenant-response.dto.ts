// src/modules/tenant/dto/tenant-response.dto.ts

import { TenantSettings } from '../interfaces/tenant-settings.interface';
import { PlanLimits, getPlanLimits } from '../constants/plan-limits.constants';
import { Tenant } from '../../../database/schema';

/**
 * Tenant response shape returned by the API.
 * Transforms the database entity into a clean API response.
 */
export class TenantResponseDto {
  id: string;
  name: string;
  slug: string;
  planType: string;
  status: string;
  defaultTimezone: string;
  defaultLocale: string;
  fiscalYearStartMonth: number;
  maxEmployees: number | null;
  settings: TenantSettings;
  planLimits: PlanLimits;
  createdAt: string;
  updatedAt: string;

  /**
   * Transform a database tenant record to API response.
   */
  static fromEntity(tenant: Tenant): TenantResponseDto {
    const dto = new TenantResponseDto();
    dto.id = tenant.id;
    dto.name = tenant.name;
    dto.slug = tenant.slug;
    dto.planType = tenant.planType;
    dto.status = tenant.status;
    dto.defaultTimezone = tenant.defaultTimezone;
    dto.defaultLocale = tenant.defaultLocale;
    dto.fiscalYearStartMonth = tenant.fiscalYearStartMonth;
    dto.maxEmployees = tenant.maxEmployees;
    dto.settings = (tenant.settings as TenantSettings) || {};
    dto.planLimits = getPlanLimits(tenant.planType);
    dto.createdAt = tenant.createdAt.toISOString();
    dto.updatedAt = tenant.updatedAt.toISOString();
    return dto;
  }
}