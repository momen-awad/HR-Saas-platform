// src/common/interceptors/timeout.interceptor.ts

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

/**
 * Global timeout interceptor.
 * Prevents requests from hanging indefinitely.
 *
 * Default: 30 seconds for standard requests.
 * Override per-route using @SetMetadata('timeout', 60000)
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly defaultTimeout = 30_000; // 30 seconds

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const timeoutValue =
      Reflect.getMetadata('timeout', context.getHandler()) ||
      this.defaultTimeout;

    return next.handle().pipe(
      timeout(timeoutValue),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(
            () =>
              new RequestTimeoutException(
                'Request timed out. Please try again.',
              ),
          );
        }
        return throwError(() => err);
      }),
    );
  }
}
