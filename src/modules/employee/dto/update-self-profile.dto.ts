// src/modules/employee/dto/update-self-profile.dto.ts

import { IsString, IsOptional, MaxLength } from 'class-validator';

/**
 * DTO for an employee updating their own profile.
 *
 * Deliberately minimal — employees may only update their timezone
 * and locale preferences. All other fields (name, department, salary)
 * require HR/admin permissions via the main employee endpoint.
 *
 * Design rationale: allowing employees to self-edit sensitive fields
 * (e.g., bank account via a different update endpoint) creates audit
 * and compliance risks. The self-service surface is intentionally small.
 */
export class UpdateSelfProfileDto {
  /**
   * IANA timezone string override.
   * e.g., 'Asia/Riyadh', 'America/New_York'
   * Pass null to revert to the tenant's default timezone.
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string | null;

  /**
   * Locale override.
   * e.g., 'en', 'ar', 'fr'
   * Pass null to revert to the tenant's default locale.
   */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  locale?: string | null;
}
