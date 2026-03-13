// src/common/pipes/uuid-validation.pipe.ts

import {
  PipeTransform,
  Injectable,
  BadRequestException,
} from '@nestjs/common';

/**
 * Validates that a route parameter is a valid UUID.
 *
 * Usage:
 *   @Get(':id')
 *   async getEmployee(@Param('id', UuidValidationPipe) id: string) { ... }
 */
@Injectable()
export class UuidValidationPipe implements PipeTransform<string, string> {
  private static readonly UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  transform(value: string): string {
    if (!UuidValidationPipe.UUID_REGEX.test(value)) {
      throw new BadRequestException(
        `Invalid UUID format: ${value}`,
      );
    }
    return value.toLowerCase();
  }
}
