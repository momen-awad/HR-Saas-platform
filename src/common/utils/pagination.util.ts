// src/common/utils/pagination.util.ts

import {
  PaginationMeta,
  PaginatedResult,
  PaginationParams,
} from '../types/pagination.types';
import { PaginationQueryDto } from '../dto/pagination-query.dto';

/**
 * PaginationHelper provides standardized pagination calculation.
 *
 * Usage in services:
 *   const params = PaginationHelper.parse(queryDto);
 *   const [items, total] = await this.repository.findAndCount({
 *     skip: params.offset,
 *     take: params.perPage,
 *   });
 *   return PaginationHelper.createResult(items, total, queryDto);
 */
export class PaginationHelper {
  /**
   * Parse a PaginationQueryDto into offset/limit parameters.
   */
  static parse(query: PaginationQueryDto): PaginationParams {
    const page = Math.max(1, query.page || 1);
    const perPage = Math.min(100, Math.max(1, query.perPage || 20));
    const offset = (page - 1) * perPage;

    return { page, perPage, offset };
  }

  /**
   * Create a paginated result from data and total count.
   */
  static createResult<T>(
    data: T[],
    total: number,
    query: PaginationQueryDto,
  ): PaginatedResult<T> {
    const { page, perPage } = PaginationHelper.parse(query);
    const totalPages = Math.ceil(total / perPage);

    return {
      data,
      pagination: {
        total,
        page,
        perPage,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  /**
   * Build pagination metadata without data.
   * Useful when data transformation happens separately.
   */
  static buildMeta(
    total: number,
    page: number,
    perPage: number,
  ): PaginationMeta {
    const totalPages = Math.ceil(total / perPage);
    return {
      total,
      page,
      perPage,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }
}

