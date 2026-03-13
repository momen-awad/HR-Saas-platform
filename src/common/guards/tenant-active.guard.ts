// src/common/guards/tenant-active.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { TenantContext } from '../context/tenant.context';

@Injectable()
export class TenantActiveGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!TenantContext.isInContext()) {
      throw new UnauthorizedException('Tenant context not found. Make sure TenantResolverMiddleware is applied.');
    }

    const tenantId = TenantContext.getTenantId();
    const timezone = TenantContext.getTenantTimezone();

    if (!tenantId) {
      throw new UnauthorizedException('Tenant ID not found in context.');
    }

    // هنا ممكن نعمل اي تحقق اضافي حسب قواعد العمل، مثلاً:
    // if (status !== 'active') throw new UnauthorizedException(...);

    // ممكن نخزن معلومات tenant في context request لو محتاجينها بعدين
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    (request as any).tenantId = tenantId;
    (request as any).tenantTimezone = timezone;

    return true;
  }
}
