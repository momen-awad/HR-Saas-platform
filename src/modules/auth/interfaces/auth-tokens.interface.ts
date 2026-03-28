// src/modules/auth/interfaces/auth-tokens.interface.ts

/**
 * Shape of the authentication response returned to clients.
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds until access token expires
  tokenType: 'Bearer';
}

/**
 * User info returned alongside tokens.
 */
export interface AuthUserInfo {
  userId: string;
  email: string;
  employeeId: string;
  tenantId: string;
  tenantName: string;
  roles: string[];
  timezone: string;
}

/**
 * Complete login response.
 */
export interface LoginResponse {
  tokens: AuthTokens;
  user: AuthUserInfo;
}