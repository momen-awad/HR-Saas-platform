// src/common/constants/public-paths.ts

import { RequestMethod } from '@nestjs/common';

/**
 * Paths that do NOT require tenant context.
 * These are either public endpoints or system-level endpoints.
 *
 * Format: { path: string, method?: RequestMethod } or just string for all methods.
 */
export const TENANT_PUBLIC_PATHS: Array<string | { path: string; method?: RequestMethod }> = [
  // Health check — no tenant needed
  'health',

  // Auth endpoints — tenant resolution happens differently
  'api/v1/auth/login',
  'api/v1/auth/register',
  'api/v1/auth/forgot-password',
  'api/v1/auth/reset-password',

  // Super admin endpoints (system-level, not tenant-scoped)
  'api/v1/admin/tenants',
];

/**
 * Check if a path should skip tenant resolution.
 */
export function isTenantPublicPath(path: string): boolean {
  const normalizedPath = path.replace(/^\/+/, '').replace(/\/+$/, '');

  return TENANT_PUBLIC_PATHS.some((publicPath) => {
    const normalizedPublic = typeof publicPath === 'string'
      ? publicPath.replace(/^\/+/, '').replace(/\/+$/, '')
      : publicPath.path.replace(/^\/+/, '').replace(/\/+$/, '');

    return (
      normalizedPath === normalizedPublic ||
      normalizedPath.startsWith(normalizedPublic + '/')
    );
  });
}
