// src/modules/employee/dto/update-salary.dto.ts

import {
  IsNumber,
  IsPositive,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsIn,
  MaxLength,
  Matches,
} from 'class-validator';

/**
 * Standard reasons for a salary change.
 * Used for reporting and audit trail consistency.
 */
export const SalaryChangeReasonEnum = {
  INITIAL: 'initial',
  ANNUAL_REVIEW: 'annual_review',
  PROMOTION: 'promotion',
  MARKET_ADJUSTMENT: 'market_adjustment',
  CORRECTION: 'correction',
  PROBATION_PASSED: 'probation_passed',
} as const;

/**
 * DTO for updating an employee's base salary.
 *
 * Each call creates an immutable salary_history record and updates
 * the encrypted baseSalaryEncrypted column on the employee row.
 */
export class UpdateSalaryDto {
  /**
   * New monthly base salary. Must be a positive number.
   */
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'baseSalary must be a number with at most 2 decimal places' })
  @IsPositive({ message: 'baseSalary must be greater than zero' })
  baseSalary: number;

  /**
   * ISO 4217 currency code for the salary.
   */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'salaryCurrency must be a 3-letter ISO 4217 currency code' })
  salaryCurrency?: string;

  /**
   * Why is this salary changing? Required for audit completeness.
   */
  @IsString()
  @IsNotEmpty()
  @IsIn(Object.values(SalaryChangeReasonEnum), {
    message: `changeReason must be one of: ${Object.values(SalaryChangeReasonEnum).join(', ')}`,
  })
  changeReason: string;

  /**
   * When does this salary take effect? Defaults to today if omitted.
   */
  @IsOptional()
  @IsDateString({}, { message: 'effectiveDate must be a valid date string (YYYY-MM-DD)' })
  effectiveDate?: string;

  /**
   * Optional free-text notes for the salary change.
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
