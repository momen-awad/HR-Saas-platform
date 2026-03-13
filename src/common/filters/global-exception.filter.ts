// src/common/filters/global-exception.filter.ts

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { BusinessException } from '../exceptions/base-business.exception';
import { RequestContext } from '../context/request.context';
import { createErrorResponse } from '../types/api-response.types';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    
    // بنستخدم RequestContext عشان الـ Request ID يكون consistent في كل الـ Logs
    const requestId = RequestContext.requestId;

    let status: number;
    let errorCode: string;
    let message: string;
    let details: Record<string, any> | undefined;

    if (exception instanceof BusinessException) {
      // Domain-specific business exceptions handling
      status = exception.getStatus();
      errorCode = exception.errorCode;
      message = exception.message;
      details = exception.details;

      this.logger.warn(
        `Business exception [${errorCode}]: ${message}`,
        { requestId, details },
      );
    } else if (exception instanceof HttpException) {
      // Standard NestJS HTTP exceptions
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        errorCode = this.statusToErrorCode(status);
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as any;
        errorCode = resp.code || this.statusToErrorCode(status);
        
        // Handle validation errors array
        message = Array.isArray(resp.message)
          ? 'Validation failed'
          : resp.message || exception.message;
          
        details = Array.isArray(resp.message)
          ? { validationErrors: resp.message }
          : resp.details;
      } else {
        errorCode = this.statusToErrorCode(status);
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      // Unhandled exceptions / System errors
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorCode = 'INTERNAL_SERVER_ERROR';
      const isProduction = process.env.NODE_ENV === 'production';
      
      // Security: Never leak error details in production
      message = isProduction
        ? 'An unexpected error occurred'
        : exception.message;

      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
        {
          requestId,
          url: request.url,
          method: request.method,
          // Debugging aid: log body in non-production only
          ...(isProduction ? {} : { body: request.body }),
        },
      );
    } else {
      // Unknown exception types
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorCode = 'UNKNOWN_ERROR';
      message = 'An unexpected error occurred';
      this.logger.error('Unknown exception type thrown', { exception, requestId });
    }

    response.status(status).json(
      createErrorResponse(errorCode, message, details, { requestId }),
    );
  }

  private statusToErrorCode(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
    };
    return map[status] || 'ERROR';
  }
}
