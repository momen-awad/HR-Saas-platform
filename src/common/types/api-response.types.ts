import { PaginationMeta } from './pagination.types';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface ApiMeta {
  requestId?: string;
  timestamp: string;
  pagination?: PaginationMeta;
}


export function createSuccessResponse<T>(
  data: T,
  meta?: Partial<ApiMeta>,
): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}

export function createErrorResponse(
  code: string,
  message: string,
  details?: Record<string, any>,
  meta?: Partial<ApiMeta>,
): ApiResponse<never> {
  return {
    success: false,
    error: { code, message, details },
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}
