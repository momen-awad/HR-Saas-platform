// src/modules/department/dto/department-query.dto.ts

import { IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/**
 * Query DTO for listing departments.
 * Extends pagination with department-specific filters.
 */
export class DepartmentQueryDto extends PaginationQueryDto {
  /**
   * When true, only active departments are returned.
   * When false, only inactive departments are returned.
   * When omitted, all departments are returned.
   */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  /**
   * When provided, returns only top-level departments (parentId IS NULL).
   * Useful for building the root of a department tree.
   */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  rootOnly?: boolean;
}
