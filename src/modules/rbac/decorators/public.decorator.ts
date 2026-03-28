// src/modules/rbac/decorators/public.decorator.ts

import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as public — skips both authentication and RBAC checks.
 *
 * Usage:
 *   @Public()
 *   @Get('health')
 *   async healthCheck() { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);