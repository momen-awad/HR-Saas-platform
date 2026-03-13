// src/common/dto/pagination-query.dto.ts

import { IsOptional, IsInt, Min, Max, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Reusable pagination query DTO.
 * Extend this in module-specific query DTOs.
 *
 * Usage:
 *   export class GetEmployeesQueryDto extends PaginationQueryDto {
 *     @IsOptional()
 *     @IsString()
 *     department?: string;
 *   }
 */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage: number = 20;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsString()
  search?: string;
}

