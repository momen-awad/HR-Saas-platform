// src/modules/tenant/dto/update-tenant-settings.dto.ts

import { IsOptional, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for updating tenant settings (JSONB).
 * Used by tenant admins to configure their own tenant.
 *
 * Settings are deep-merged: only provided keys are updated,
 * existing keys not in the payload are preserved.
 */
export class UpdateTenantSettingsDto {
  @IsOptional()
  @IsObject()
  features?: Record<string, boolean>;

  @IsOptional()
  @IsObject()
  branding?: Record<string, string>;

  @IsOptional()
  @IsObject()
  notifications?: Record<string, any>;

  @IsOptional()
  @IsObject()
  attendance?: Record<string, any>;

  @IsOptional()
  @IsObject()
  payroll?: Record<string, any>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}