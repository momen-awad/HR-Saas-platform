// src/common/constants/app.constants.ts

/**
 * Application-wide constants.
 */
export const APP_CONSTANTS = {
  /**
   * Maximum items per page for paginated endpoints.
   */
  MAX_PAGE_SIZE: 100,

  /**
   * Default items per page.
   */
  DEFAULT_PAGE_SIZE: 20,

  /**
   * Timestamp fields that should be converted to user timezone
   * in API responses.
   */
  TIMESTAMP_FIELDS: [
    'createdAt',
    'updatedAt',
    'checkInAt',
    'checkOutAt',
    'approvedAt',
    'finalizedAt',
    'lastLoginAt',
    'registeredAt',
    'deliveredAt',
    'readAt',
    'actedAt',
    'initiatedAt',
    'calculatedAt',
    'processedAt',
    'terminationDate',
    'hireDate',
  ] as const,

  /**
   * Standard working hours per day (used as fallback).
   */
  DEFAULT_WORKING_HOURS_PER_DAY: 8,

  /**
   * Standard working days bitmask (Mon-Fri).
   * Mon=1, Tue=2, Wed=4, Thu=8, Fri=16, Sat=32, Sun=64
   */
  DEFAULT_WORKING_DAYS_BITMASK: 31, // 1+2+4+8+16 = Mon-Fri

  /**
   * Maximum failed login attempts before account lockout.
   */
  MAX_FAILED_LOGIN_ATTEMPTS: 5,

  /**
   * Account lockout duration in minutes.
   */
  LOCKOUT_DURATION_MINUTES: 30,

  /**
   * Default tenant cache TTL in seconds.
   */
  TENANT_CACHE_TTL_SECONDS: 60,
} as const;
