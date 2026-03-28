// src/modules/tenant/services/tenant.service.ts

import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

// ── الـ imports كلها في الأعلى ────────────────────────────────────────────────
import { TenantRepository }       from '../repositories/tenant.repository';
import { EventBusService }        from '../../../common/events/event-bus.service';
import { CreateTenantDto }        from '../dto/create-tenant.dto';
import { UpdateTenantDto }        from '../dto/update-tenant.dto';
import { UpdateTenantStatusDto }  from '../dto/update-tenant-status.dto';
import { TenantQueryDto }         from '../dto/tenant-query.dto';
import { TenantResponseDto }      from '../dto/tenant-response.dto';
import { TenantCreatedEvent }     from '../events/tenant-created.event';
import { TenantSuspendedEvent }   from '../events/tenant-suspended.event';
import { TenantActivatedEvent }   from '../events/tenant-activated.event';
import {
  TenantStatusEnum,
  TenantStatusType,
  isValidStatusTransition,
  VALID_STATUS_TRANSITIONS,       // ← هنا في الأعلى مش في نص الملف
} from '../constants/tenant-status.constants';
import { getPlanLimits }          from '../constants/plan-limits.constants';
import { DEFAULT_TENANT_SETTINGS } from '../interfaces/tenant-settings.interface';
import { DateUtil }               from '../../../common/utils/date.util';
import { PaginationHelper }       from '../../../common/utils/pagination.util';
import { PaginatedResult }        from '../../../common/types/pagination.types';

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    private readonly tenantRepo: TenantRepository,
    private readonly eventBus:   EventBusService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * إنشاء tenant جديد.
   *
   * الخطوات:
   * 1. التحقق من uniqueness الـ slug
   * 2. التحقق من صحة الـ timezone
   * 3. تحديد الـ maxEmployees من الـ plan لو مش متحدد
   * 4. إنشاء الـ tenant record
   * 5. إطلاق TenantCreatedEvent (يطلق الـ onboarding عبر الـ event handler)
   */
  async createTenant(
    dto: CreateTenantDto,
    createdBy: string,
  ): Promise<TenantResponseDto> {
    // 1. التحقق من uniqueness الـ slug
    const slugTaken = await this.tenantRepo.isSlugTaken(dto.slug);
    if (slugTaken) {
      throw new ConflictException(
        `Tenant slug '${dto.slug}' is already in use.`,
      );
    }

    // 2. التحقق من صحة الـ timezone
    if (dto.defaultTimezone && !DateUtil.isValidTimezone(dto.defaultTimezone)) {
      throw new BadRequestException(
        `Invalid timezone: '${dto.defaultTimezone}'. Use IANA timezone format (e.g., 'America/New_York').`,
      );
    }

    // 3. تحديد الـ maxEmployees من الـ plan
    const planLimits   = getPlanLimits(dto.planType || 'free');
    const maxEmployees = dto.maxEmployees || planLimits.maxEmployees;

    // 4. دمج الـ default settings مع الـ settings المقدمة
    const settings = dto.settings
      ? { ...DEFAULT_TENANT_SETTINGS, ...dto.settings }
      : DEFAULT_TENANT_SETTINGS;

    // 5. إنشاء الـ tenant
    const tenant = await this.tenantRepo.create({
      name:                 dto.name,
      slug:                 dto.slug,
      planType:             dto.planType || 'free',
      status:               TenantStatusEnum.ACTIVE,
      defaultTimezone:      dto.defaultTimezone || 'UTC',
      defaultLocale:        dto.defaultLocale   || 'en',
      fiscalYearStartMonth: dto.fiscalYearStartMonth || 1,
      maxEmployees,
      settings,
    });

    this.logger.log(
      `Tenant created: ${tenant.name} [${tenant.id}] (plan: ${tenant.planType})`,
    );

    // 6. إطلاق الـ event للـ onboarding
    const event = new TenantCreatedEvent(
      tenant.id,
      createdBy,
      tenant.name,
      tenant.slug,
      tenant.planType,
      dto.adminEmail,
      dto.adminFirstName,
      dto.adminLastName,
    );

    await this.eventBus.emitAsync(event);

    return TenantResponseDto.fromEntity(tenant);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // READ
  // ─────────────────────────────────────────────────────────────────────────

  async getTenantById(id: string): Promise<TenantResponseDto> {
    const tenant = await this.tenantRepo.findById(id);
    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${id}`);
    }
    return TenantResponseDto.fromEntity(tenant);
  }

  async getTenantBySlug(slug: string): Promise<TenantResponseDto> {
    const tenant = await this.tenantRepo.findBySlug(slug);
    if (!tenant) {
      throw new NotFoundException(`Tenant not found with slug: ${slug}`);
    }
    return TenantResponseDto.fromEntity(tenant);
  }

  async listTenants(
    query: TenantQueryDto,
  ): Promise<PaginatedResult<TenantResponseDto>> {
    const { data, total } = await this.tenantRepo.findMany(query);
    const responseDtos    = data.map(TenantResponseDto.fromEntity);
    return PaginationHelper.createResult(responseDtos, total, query);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────────────────────────────────

  async updateTenant(
    id: string,
    dto: UpdateTenantDto,
  ): Promise<TenantResponseDto> {
    const existing = await this.tenantRepo.findById(id);
    if (!existing) {
      throw new NotFoundException(`Tenant not found: ${id}`);
    }

    if (dto.defaultTimezone && !DateUtil.isValidTimezone(dto.defaultTimezone)) {
      throw new BadRequestException(
        `Invalid timezone: '${dto.defaultTimezone}'.`,
      );
    }

    // لو بيتغير الـ plan → نحدّث الـ maxEmployees تلقائياً (ما لم يكن محدداً صراحةً)
    const updateData: Record<string, any> = { ...dto };
    if (dto.planType && !dto.maxEmployees) {
      const newPlanLimits        = getPlanLimits(dto.planType);
      updateData.maxEmployees    = newPlanLimits.maxEmployees;
    }

    const updated = await this.tenantRepo.update(id, updateData);
    if (!updated) {
      throw new NotFoundException(`Tenant not found: ${id}`);
    }

    this.logger.log(`Tenant updated: ${updated.name} [${updated.id}]`);

    return TenantResponseDto.fromEntity(updated);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STATUS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * تغيير حالة الـ tenant مع التحقق من صحة الـ transition.
   */
  async updateTenantStatus(
    id: string,
    dto: UpdateTenantStatusDto,
    changedBy: string,
  ): Promise<TenantResponseDto> {
    const tenant = await this.tenantRepo.findById(id);
    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${id}`);
    }

    const currentStatus = tenant.status as TenantStatusType;
    const newStatus     = dto.status    as TenantStatusType;

    // التحقق من صحة الـ transition
    if (!isValidStatusTransition(currentStatus, newStatus)) {
      const allowed = validTransitionsStr(currentStatus);
      throw new BadRequestException(
        `Invalid status transition: '${currentStatus}' → '${newStatus}'. ` +
        `Allowed from '${currentStatus}': [${allowed}]`,
      );
    }

    const updated = await this.tenantRepo.updateStatus(id, newStatus);
    if (!updated) {
      throw new NotFoundException(`Tenant not found: ${id}`);
    }

    // إطلاق الـ events المناسبة
    if (newStatus === TenantStatusEnum.SUSPENDED) {
      await this.eventBus.emitAsync(
        new TenantSuspendedEvent(id, changedBy, dto.reason),
      );
    } else if (
      newStatus     === TenantStatusEnum.ACTIVE &&
      currentStatus === TenantStatusEnum.SUSPENDED
    ) {
      await this.eventBus.emitAsync(
        new TenantActivatedEvent(id, changedBy),
      );
    }

    this.logger.log(
      `Tenant status changed: ${tenant.name} [${id}] ` +
      `${currentStatus} → ${newStatus}` +
      (dto.reason ? ` (reason: ${dto.reason})` : ''),
    );

    return TenantResponseDto.fromEntity(updated);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * بيرجع الـ transitions المسموح بيها كـ string للـ error messages.
 * (helper داخلي للملف ده بس — مش exported)
 */
function validTransitionsStr(status: TenantStatusType): string {
  return VALID_STATUS_TRANSITIONS[status]?.join(', ') || 'none';
}
