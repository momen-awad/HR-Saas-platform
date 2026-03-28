// src/modules/tenant/dto/update-tenant.dto.ts

import {
  IsString,
  IsOptional,
  IsIn,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { PlanTypeEnum } from '../constants/plan-limits.constants';

/**
 * DTO for updating tenant core fields.
 * Used by super admin to change plan, limits, etc.
 */
export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsIn(Object.values(PlanTypeEnum))
  planType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  defaultTimezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  defaultLocale?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  fiscalYearStartMonth?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxEmployees?: number;
}