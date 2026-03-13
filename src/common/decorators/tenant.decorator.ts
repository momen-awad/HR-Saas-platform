// src/common/decorators/tenant.decorator.ts

import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';

/**
 * Tenant metadata shape stored on request by middleware.
 */
export interface RequestTenant {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  locale: string;
  planType: string;
  status: string;
}

/**
 * Parameter decorator to extract full tenant info from the request.
 *
 * Usage:
 *   @Get('settings')
 *   async getSettings(@CurrentTenant() tenant: RequestTenant) {
 *     return this.configService.getSettings(tenant.id, tenant.timezone);
 *   }
 */
export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): RequestTenant => {
    const request = ctx.switchToHttp().getRequest();
    const tenant = request.tenant;

    if (!tenant) {
      throw new InternalServerErrorException(
        'Tenant info not found in request. Ensure TenantResolverMiddleware is active.',
      );
    }

    return tenant;
  },
);
