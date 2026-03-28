// src/modules/tenant/controllers/tenant.controller.ts

import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Body,
  Query,
  Logger,
} from '@nestjs/common';
import { TenantService } from '../services/tenant.service';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import { UpdateTenantDto } from '../dto/update-tenant.dto';
import { UpdateTenantStatusDto } from '../dto/update-tenant-status.dto';
import { TenantQueryDto } from '../dto/tenant-query.dto';
import { UuidValidationPipe } from '../../../common/pipes/uuid-validation.pipe';

/**
 * Tenant management controller for super admins.
 *
 * Mounted at: /api/v1/admin/tenants
 *
 * NOTE: This controller is EXCLUDED from the TenantResolverMiddleware
 * (configured in app.module.ts). These endpoints are NOT tenant-scoped
 * — they are platform-level operations.
 *
 * When Module 2.3 (RBAC) is built, these endpoints will be gated
 * by @RequirePermissions('super_admin') or similar.
 */
@Controller('admin/tenants')
export class TenantController {
  private readonly logger = new Logger(TenantController.name);

  constructor(private readonly tenantService: TenantService) {}

  /**
   * Create a new tenant.
   * POST /api/v1/admin/tenants
   */
  @Post()
  async createTenant(@Body() dto: CreateTenantDto) {
    // TODO: Get createdBy from JWT when auth is built
    const createdBy = 'system';
    return this.tenantService.createTenant(dto, createdBy);
  }

  /**
   * List all tenants with pagination and filtering.
   * GET /api/v1/admin/tenants
   */
  @Get()
  async listTenants(@Query() query: TenantQueryDto) {
    return this.tenantService.listTenants(query);
  }

  /**
   * Get a tenant by ID.
   * GET /api/v1/admin/tenants/:id
   */
  @Get(':id')
  async getTenant(@Param('id', UuidValidationPipe) id: string) {
    return this.tenantService.getTenantById(id);
  }

  /**
   * Update a tenant's core fields.
   * PUT /api/v1/admin/tenants/:id
   */
  @Put(':id')
  async updateTenant(
    @Param('id', UuidValidationPipe) id: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenantService.updateTenant(id, dto);
  }

  /**
   * Change a tenant's status.
   * PATCH /api/v1/admin/tenants/:id/status
   */
  @Patch(':id/status')
  async updateTenantStatus(
    @Param('id', UuidValidationPipe) id: string,
    @Body() dto: UpdateTenantStatusDto,
  ) {
    // TODO: Get changedBy from JWT when auth is built
    const changedBy = 'system';
    return this.tenantService.updateTenantStatus(id, dto, changedBy);
  }
}