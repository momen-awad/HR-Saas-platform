// src/common/types/pagination.types.ts

/**
 * Pagination metadata included in all list API responses.
 */
export interface PaginationMeta {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Paginated response wrapper.
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

/**
 * Parsed pagination parameters from query string.
 */
export interface PaginationParams {
  page: number;
  perPage: number;
  offset: number;
}

/**
 * Sort direction.
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Sort parameters.
 */
export interface SortParams {
  field: string;
  direction: SortDirection;
}
