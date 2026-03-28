// src/modules/tenant/controllers/tenant-settings.controller.ts

import {
  Controller,
  Get,
  Put,
  Body,
  Logger,
} from '@nestjs/common';
import { TenantSettingsService } from '../services/tenant-settings.service';
import { UpdateTenantSettingsDto } from '../dto/update-tenant-settings.dto';
import { TenantId } from '../../../common/decorators/tenant-id.decorator';

/**
 * Tenant settings controller for tenant admins.
 *
 * Mounted at: /api/v1/tenant/settings
 *
 * These endpoints ARE tenant-scoped (go through TenantResolverMiddleware).
 * The tenant ID comes from the JWT/header, not from a URL parameter.
 *
 * When Module 2.3 (RBAC) is built, these endpoints will be gated
 * by @RequirePermissions('config:manage') or 'tenant_admin' role.
 */
@Controller('tenant/settings')
export class TenantSettingsController {
  private readonly logger = new Logger(TenantSettingsController.name);

  constructor(
    private readonly settingsService: TenantSettingsService,
  ) {}

  /**
   * Get current tenant settings.
   * GET /api/v1/tenant/settings
   */
  @Get()
  async getSettings(@TenantId() tenantId: string) {
    return this.settingsService.getSettings(tenantId);
  }

  /**
   * Update current tenant settings.
   * PUT /api/v1/tenant/settings
   */
  @Put()
  async updateSettings(
    @TenantId() tenantId: string,
    @Body() dto: UpdateTenantSettingsDto,
  ) {
    return this.settingsService.updateSettings(tenantId, dto);
  }
}