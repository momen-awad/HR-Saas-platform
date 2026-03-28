// src/modules/auth/interfaces/jwt-payload.interface.ts

/**
 * Shape of the JWT access token claims.
 *
 * This is embedded in every access token and available in
 * every request handler via @CurrentUser() decorator.
 *
 * IMPORTANT: Keep this payload SMALL. JWTs are sent with every request.
 * Do NOT include sensitive data (salary, bank account).
 * Do NOT include large arrays (full permission list — use role names
 * and resolve permissions server-side if needed).
 */
export interface JwtPayload {
  /** User ID (from users table) */
  sub: string;

  /** Tenant ID the user is currently operating in */
  tenantId: string;

  /** Employee ID within the tenant (from employees table) */
  employeeId: string;

  /** Role names assigned to this employee */
  roles: string[];
  
  permissions: string[]; 

  /** User's display email (for logging, not for auth decisions) */
  email: string;

  /** User's timezone (for response transformation) */
  tz: string;

  /** Token issued at (Unix timestamp) */
  iat?: number;

  /** Token expiry (Unix timestamp) */
  exp?: number;

  /** Unique token ID (for revocation tracking) */
  jti?: string;
}
