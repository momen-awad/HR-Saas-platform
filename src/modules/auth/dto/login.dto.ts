// src/modules/auth/dto/login.dto.ts

import {
  IsEmail,
  IsString,
  MinLength,
  IsUUID,
  IsOptional,
} from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;

  /**
   * Tenant the user wants to access.
   * Required because a user can be an employee at multiple tenants.
   */
  @IsUUID('4', { message: 'Invalid tenant identifier' })
  tenantId: string;

  /**
   * MFA code (if MFA is enabled for the user).
   * Optional — if MFA is required but not provided, the response
   * will indicate MFA is needed.
   */
  @IsOptional()
  @IsString()
  mfaCode?: string;
}