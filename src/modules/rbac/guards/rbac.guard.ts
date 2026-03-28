// src/modules/rbac/guards/rbac.guard.ts

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PERMISSIONS_KEY,
  PERMISSION_MODE_KEY,
  PermissionMode,
} from '../decorators/require-permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { InsufficientPermissionsException } from '../../../common/exceptions/business-exceptions';

/**
 * RbacGuard checks whether the authenticated user's permissions
 * satisfy the requirements declared by @RequirePermissions().
 *
 * Permission checking flow:
 * 1. Check if route is marked @Public() → skip check
 * 2. Check if route has @RequirePermissions() → if not, allow (authenticated only)
 * 3. Read user permissions from request (set by auth middleware/guard)
 * 4. Check if user has required permissions (ALL or ANY based on mode)
 * 5. Return 403 with details if insufficient
 *
 * The guard reads permissions from request.user.permissions,
 * which is populated from the JWT token by the auth guard.
 */
@Injectable()
export class RbacGuard implements CanActivate {
  private readonly logger = new Logger(RbacGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
  /**
 * DESIGN DECISION: Permissions are read from JWT claims, not from database.
 * This makes permission checks O(1) with no database round-trip.
 *
 * TRADE-OFF: When an employee's roles change, their active JWT still
 * carries the old permissions until it expires (15 minutes).
 *
 * MITIGATION OPTIONS (if needed):
 * 1. Short JWT TTL (already 15 minutes)
 * 2. Token revocation list in Redis (checked on each request)
 * 3. Force re-login when roles change (emit event → invalidate tokens)
 *
 * For Phase 1, option 1 is sufficient. Options 2/3 can be added later.
 */
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Get required permissions from decorator
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permissions specified, allow any authenticated user
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // Get permission mode (ALL or ANY)
    const mode =
      this.reflector.getAllAndOverride<PermissionMode>(PERMISSION_MODE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || 'ALL';

    // Get user from request
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.warn('RbacGuard: No user on request. Auth guard may be missing.');
      throw new InsufficientPermissionsException(requiredPermissions);
    }

    const userPermissions: string[] = user.permissions || [];

    // Check permissions based on mode
    let hasAccess: boolean;
    if (mode === 'ALL') {
      hasAccess = requiredPermissions.every((perm) =>
        userPermissions.includes(perm),
      );
    } else {
      hasAccess = requiredPermissions.some((perm) =>
        userPermissions.includes(perm),
      );
    }

    if (!hasAccess) {
      const missing = requiredPermissions.filter(
        (perm) => !userPermissions.includes(perm),
      );
      this.logger.warn(
        `Access denied for user ${user.sub || 'unknown'}: ` +
        `missing permissions: ${missing.join(', ')}`,
      );
      throw new InsufficientPermissionsException(missing);
    }

    return true;
  }
}
