// src/modules/employee/dto/change-employee-status.dto.ts

import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsOptional,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { EmployeeStatusEnum } from '../constants/employee-status.constants';

/**
 * DTO for changing an employee's status.
 *
 * The service enforces valid status transitions via the state machine
 * defined in employee-status.constants.ts.
 */
export class ChangeEmployeeStatusDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(Object.values(EmployeeStatusEnum))
  status: string;

  /**
   * Required when status is 'terminated' or 'suspended'.
   * Provides a human-readable reason for the status change.
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  /**
   * The effective date of termination (ISO 8601: YYYY-MM-DD).
   * Required when status is 'terminated'.
   * Defaults to today if not provided.
   */
  @IsOptional()
  @IsDateString({}, { message: 'terminationDate must be a valid date string (YYYY-MM-DD)' })
  terminationDate?: string;
}
