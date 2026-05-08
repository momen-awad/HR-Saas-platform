// src/modules/employee/dto/create-employee.dto.ts

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEmail,
  IsIn,
  IsDateString,
  IsNumber,
  IsPositive,
  MaxLength,
  MinLength,
  Matches,
  Min,
} from 'class-validator';
import {
  EmploymentTypeEnum,
} from '../constants/employee-status.constants';

/**
 * DTO for creating a new employee profile.
 *
 * Note on salary: the value is provided as a plain number and encrypted
 * by the service before persistence. Never returned in responses.
 */
export class CreateEmployeeDto {
  /**
   * The user account that will own this employee profile.
   * Must already exist in the users table.
   * One user can only have one employee record per tenant.
   */
  @IsUUID('4', { message: 'userId must be a valid UUID' })
  userId: string;

  /**
   * Tenant-unique identifier shown on payslips and HR documents.
   * e.g., 'EMP-001', 'HR-042'
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  employeeNumber: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @IsOptional()
  @IsUUID('4', { message: 'departmentId must be a valid UUID' })
  departmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  position?: string;

  @IsOptional()
  @IsIn(Object.values(EmploymentTypeEnum))
  employmentType?: string;

  /**
   * Monthly base salary in plaintext. Encrypted by the service before storage.
   * Must be a positive number with at most 2 decimal places.
   */
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'baseSalary must be a number with at most 2 decimal places' })
  @IsPositive({ message: 'baseSalary must be greater than zero' })
  baseSalary: number;

  /**
   * ISO 4217 currency code. Defaults to 'USD'.
   */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'salaryCurrency must be a 3-letter ISO 4217 currency code' })
  salaryCurrency?: string;

  /**
   * ISO 8601 date string (YYYY-MM-DD).
   */
  @IsDateString({}, { message: 'hireDate must be a valid date string (YYYY-MM-DD)' })
  hireDate: string;

  /**
   * IANA timezone string. Falls back to tenant default when omitted.
   * e.g., 'Asia/Riyadh', 'America/New_York'
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;

  /**
   * Locale override. Falls back to tenant default when omitted.
   * e.g., 'en', 'ar'
   */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  locale?: string;

  /**
   * Bank account number (optional). Encrypted before storage.
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankAccount?: string;

  /**
   * Tax ID (optional). Encrypted before storage.
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  taxId?: string;
}
