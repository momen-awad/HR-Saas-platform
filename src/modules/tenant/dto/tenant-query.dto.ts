// src/modules/tenant/dto/tenant-query.dto.ts

import { IsOptional, IsString, IsIn } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { TenantStatusEnum } from '../constants/tenant-status.constants';
import { PlanTypeEnum } from '../constants/plan-limits.constants';

/**
 * Query DTO for listing tenants.
 * Extends pagination with tenant-specific filters.
 */
export class TenantQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(Object.values(TenantStatusEnum))
  status?: string;

  @IsOptional()
  @IsIn(Object.values(PlanTypeEnum))
  planType?: string;

  
}
