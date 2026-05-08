// src/modules/employee/dto/employee-query.dto.ts

import { IsOptional, IsString, IsIn, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { EmployeeStatusEnum, EmploymentTypeEnum } from '../constants/employee-status.constants';

/**
 * Query DTO for listing employees with optional filters.
 * Extends pagination with employee-specific filters.
 */
export class EmployeeQueryDto extends PaginationQueryDto {
  /**
   * Filter by employee status.
   */
  @IsOptional()
  @IsIn(Object.values(EmployeeStatusEnum))
  status?: string;

  /**
   * Filter by department ID.
   */
  @IsOptional()
  @IsUUID('4')
  departmentId?: string;

  /**
   * Filter by employment type.
   */
  @IsOptional()
  @IsIn(Object.values(EmploymentTypeEnum))
  employmentType?: string;
}
