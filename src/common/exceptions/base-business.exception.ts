// src/common/exceptions/base-business.exception.ts

import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from './error-codes';

/**
 * Base class for all business domain exceptions.
 *
 * Provides:
 * - A stable error code (from ErrorCodes registry)
 * - A human-readable message
 * - Optional details object for structured error info
 * - HTTP status code mapping
 *
 * All business exceptions extend this class. The GlobalExceptionFilter
 * recognizes it and formats the response accordingly.
 */
export class BusinessException extends HttpException {
  public readonly errorCode: ErrorCode;
  public readonly details?: Record<string, any>;

  constructor(
    errorCode: ErrorCode,
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: Record<string, any>,
  ) {
    super(
      {
        code: errorCode,
        message,
        details,
      },
      statusCode,
    );

    this.errorCode = errorCode;
    this.details = details;
  }
}

