// src/modules/employee/dto/update-employee.dto.ts

import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  MaxLength,
} from 'class-validator';
import { EmploymentTypeEnum } from '../constants/employee-status.constants';

/**
 * DTO for updating an employee's non-sensitive profile fields.
 *
 * Salary changes have a dedicated endpoint (PATCH /:id/salary)
 * because they require a change reason and create a history record.
 *
 * Status changes have a dedicated endpoint (PATCH /:id/status)
 * because they enforce a state machine and may trigger side effects.
 */
export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  /**
   * Pass null explicitly to unassign the department.
   * Pass a UUID to reassign to a different active department.
   * Omit to leave unchanged.
   */
  @IsOptional()
  @IsUUID('4', { message: 'departmentId must be a valid UUID' })
  departmentId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  position?: string;

  @IsOptional()
  @IsIn(Object.values(EmploymentTypeEnum))
  employmentType?: string;

  /**
   * IANA timezone string override.
   * Pass null explicitly to fall back to tenant default.
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  locale?: string | null;
}
