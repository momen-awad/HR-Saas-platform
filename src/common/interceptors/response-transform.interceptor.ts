// src/common/interceptors/response-transform.interceptor.ts

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';
import { RequestContext } from '../context/request.context';

/**
 * Standard API Response Envelope Interface
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  meta: {
    requestId: string;
    timestamp: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

/**
 * Global interceptor that wraps all successful responses in the
 * standard ApiResponse envelope.
 *
 * Design Principle: "Wrap once, detect smartly"
 * 
 * Input from controller:
 *   { id: '123', name: 'John' }
 *   or
 *   { data: [...], pagination: { total: 50, ... } }
 *
 * Output to client:
 *   {
 *     "success": true,
 *     "data": { id: '123', name: 'John' },
 *     "meta": { 
 *       "requestId": "abc", 
 *       "timestamp": "2025-...",
 *       "pagination": { ... } // if applicable
 *     }
 *   }
 *
 * Smart Detection:
 * - Checks for BOTH `success` AND `meta` to identify pre-wrapped responses
 * - This prevents double-wrapping business objects that happen to have a `success` field
 * - Adds requestId to meta if missing (for edge cases)
 */
@Injectable()
export class ResponseTransformInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ResponseTransformInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((responseData) => {
        const request = context.switchToHttp().getRequest<Request>();
        const response = context.switchToHttp().getResponse<Response>();
        const requestId =
          (request as any).requestId || RequestContext.requestId;

        // ── Case 1: Response already wrapped (success + meta) ──
        // ✅ More robust than checking `success` alone
        if (
          responseData &&
          typeof responseData === 'object' &&
          'success' in responseData &&
          'meta' in responseData
        ) {
          // Ensure requestId is present in meta (defensive)
          if (!responseData.meta.requestId && requestId) {
            responseData.meta.requestId = requestId;
            this.logger.debug('Added missing requestId to pre-wrapped response');
          }
          return responseData as ApiResponse;
        }

        // ── Case 2: Paginated response (data + pagination) ──
        // Common pattern from repository methods with pagination
        if (
          responseData &&
          typeof responseData === 'object' &&
          'data' in responseData &&
          'pagination' in responseData
        ) {
          return {
            success: true,
            data: responseData.data,
            meta: {
              requestId,
              timestamp: new Date().toISOString(),
              pagination: responseData.pagination,
            },
          } as ApiResponse;
        }

        // ── Case 3: Standard response (wrap raw data) ──
        return {
          success: true,
          data: responseData,
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
          },
        } as ApiResponse;
      }),
    );
  }

  /**
   * Utility: Check if a response object is already wrapped
   * Can be used in controllers/tests for conditional logic
   */
  static isWrapped(response: any): response is ApiResponse {
    return (
      response &&
      typeof response === 'object' &&
      'success' in response &&
      'meta' in response
    );
  }

  /**
   * Utility: Create a paginated response manually
   * Useful when you need to bypass the interceptor (rare cases)
   */
  static createPaginatedResponse<T>(
    data: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    },
    requestId?: string,
  ): ApiResponse<T[]> {
    return {
      success: true,
      data,
      meta: {
        requestId: requestId || '',
        timestamp: new Date().toISOString(),
        pagination,
      },
    };
  }
}
