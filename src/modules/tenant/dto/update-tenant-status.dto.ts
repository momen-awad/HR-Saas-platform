// src/modules/tenant/dto/update-tenant-status.dto.ts

import { IsString, IsNotEmpty, IsIn, IsOptional, MaxLength } from 'class-validator';
import { TenantStatusEnum } from '../constants/tenant-status.constants';

/**
 * DTO for changing tenant status.
 * Used by super admin only.
 */
export class UpdateTenantStatusDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(Object.values(TenantStatusEnum))
  status: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}