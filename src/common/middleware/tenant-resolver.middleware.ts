import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  ForbiddenException,
  Logger,
  Inject,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { INJECTION_TOKENS } from '../constants/injection-tokens';
import type { DrizzleDatabase } from '../../database/database.providers';
import { tenants } from '../../database/schema';
import { TenantContext } from '../context/tenant.context';
import { RequestContext } from '../context/request.context';

@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantResolverMiddleware.name);

  constructor(
    @Inject(INJECTION_TOKENS.DRIZZLE)
    private readonly db: DrizzleDatabase,
  ) {}

  private extractTenantId(req: Request): string | undefined {
    // Priority 1: From Authorization header (JWT)
    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const payload = JSON.parse(
          Buffer.from(token.split('.')[1], 'base64').toString(),
        );
        if (payload.tenantId) {
          return payload.tenantId;
        }
      } catch {
        // ignore malformed token
      }
    }

    // Priority 2: From header (development / pre-auth)
    const headerTenantId = req.headers['x-tenant-id'] as string;
    if (headerTenantId) {
      return headerTenantId.trim();
    }

    return undefined;
  }

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const url = req.originalUrl;

    // ✅ Bypass public/system routes (safeguard)
    if (
      url.startsWith('/api/auth') ||
      url.startsWith('/api/v1/auth') ||
      url.startsWith('/api/admin/tenants') ||
      url.startsWith('/api/v1/admin/tenants') ||
      url.startsWith('/health')
    ) {
      return next();
    }

    const tenantId = this.extractTenantId(req);
    if (!tenantId) {
      throw new UnauthorizedException(
        'Tenant context is required. Provide X-Tenant-ID header or authenticate.',
      );
    }

    this.validateUuid(tenantId);

    const tenant = await this.db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    });

    if (!tenant) {
      throw new UnauthorizedException('Tenant not found.');
    }

    if (tenant.status !== 'active') {
      if (tenant.status === 'suspended') {
        throw new ForbiddenException('Tenant account suspended.');
      }
      if (tenant.status === 'terminated') {
        throw new ForbiddenException('Tenant account terminated.');
      }
      throw new ForbiddenException('Tenant is not active.');
    }

    const tenantStore = {
      tenantId: tenant.id.trim(),
      tenantSlug: tenant.slug,
      tenantTimezone: tenant.defaultTimezone,
      tenantStatus: tenant.status,
    };

    (req as any).tenantId = tenant.id.trim();

    this.logger.debug(
      `[TENANT_RESOLVED] tenant=${tenant.id} request=${RequestContext.requestId}`,
    );

    TenantContext.run(tenantStore, () => next());
  }

  private validateUuid(value: string): void {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new UnauthorizedException('Invalid tenant ID format');
    }
  }
}
