// src/modules/tenant/dto/create-tenant.dto.ts

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsInt,
  Min,
  Max,
  MaxLength,
  MinLength,
  Matches,
  IsObject,
  IsEmail,
} from 'class-validator';
import { PlanTypeEnum } from '../constants/plan-limits.constants';

/**
 * DTO for creating a new tenant.
 * Used by super admin only.
 */
export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  /**
   * URL-safe unique identifier.
   * Must be lowercase alphanumeric with hyphens.
   * Example: 'acme-corp', 'beta-inc'
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase alphanumeric with hyphens (e.g., "acme-corp")',
  })
  slug: string;

  @IsOptional()
  @IsIn(Object.values(PlanTypeEnum))
  planType?: string = PlanTypeEnum.FREE;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  defaultTimezone?: string = 'UTC';

  @IsOptional()
  @IsString()
  @MaxLength(10)
  defaultLocale?: string = 'en';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  fiscalYearStartMonth?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxEmployees?: number;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  /**
   * Initial admin user details.
   * An admin user is created during onboarding.
   */
  @IsEmail()
  @IsNotEmpty()
  adminEmail: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  adminFirstName: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  adminLastName: string;
}