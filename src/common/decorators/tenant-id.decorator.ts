// src/common/decorators/tenant-id.decorator.ts

import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';

/**
 * Parameter decorator to extract the current tenant ID from the request.
 *
 * Usage in controllers:
 *   @Get('employees')
 *   async getEmployees(@TenantId() tenantId: string) {
 *     return this.employeeService.findAll(tenantId);
 *   }
 *
 * This reads from the request object (set by TenantResolverMiddleware).
 * It is a convenience decorator — services can also use TenantContext.currentTenantId.
 */
export const TenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const tenantId = request.tenantId;

    if (!tenantId) {
      throw new InternalServerErrorException(
        'TenantId not found in request. Ensure TenantResolverMiddleware is active.',
      );
    }

    return tenantId;
  },
);
