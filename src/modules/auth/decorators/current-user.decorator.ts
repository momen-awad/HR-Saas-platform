// src/modules/auth/decorators/current-user.decorator.ts

import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Extract the current authenticated user from the request.
 *
 * Usage:
 *   @Get('me')
 *   async getMe(@CurrentUser() user: JwtPayload) {
 *     return user;
 *   }
 *
 *   // Extract specific field
 *   @Get('my-tenant')
 *   async getMyTenant(@CurrentUser('tenantId') tenantId: string) {
 *     return tenantId;
 *   }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtPayload;

    if (!user) {
      throw new UnauthorizedException('No authenticated user.');
    }

    return data ? user[data] : user;
  },
);
