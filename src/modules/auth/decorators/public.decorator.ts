// src/modules/auth/decorators/public.decorator.ts

import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark a route as public (no JWT required).
 *
 * Usage:
 *   @Public()
 *   @Post('login')
 *   async login() { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);