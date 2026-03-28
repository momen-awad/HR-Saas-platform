// src/modules/tenant/interfaces/tenant-settings.interface.ts

/**
 * Strongly-typed tenant settings stored as JSONB.
 *
 * All settings have sensible defaults. The JSONB column
 * allows adding new settings without schema migrations.
 */
export interface TenantSettings {
  /**
   * Feature flags — override plan-level feature access.
   * If not set, falls back to plan defaults.
   */
  features?: Partial<{
    gpsTracking: boolean;
    geofencing: boolean;
    overtime: boolean;
    leaveManagement: boolean;
    payroll: boolean;
    customPolicies: boolean;
    apiAccess: boolean;
    webhooks: boolean;
    auditExport: boolean;
    multiCurrency: boolean;
  }>;

  /**
   * Branding
   */
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
    companyWebsite?: string;
  };

  /**
   * Notification preferences at the tenant level.
   */
  notifications?: {
    emailEnabled?: boolean;
    pushEnabled?: boolean;
    defaultEmailFrom?: string;
  };

  /**
   * Attendance configuration defaults.
   */
  attendance?: {
    autoCheckoutEnabled?: boolean;
    autoCheckoutTimeHour?: number; // 0-23, in tenant timezone
    gracePeriodMinutes?: number;
    requireGps?: boolean;
    requireGeofence?: boolean;
    allowManualEntry?: boolean;
  };

  /**
   * Payroll configuration defaults.
   */
  payroll?: {
    payrollDayOfMonth?: number; // 1-28
    currency?: string;
    payslipEmailEnabled?: boolean;
  };

  /**
   * Custom metadata.
   * Tenants can store arbitrary key-value pairs.
   */
  metadata?: Record<string, any>;
}

/**
 * Default tenant settings applied during onboarding.
 */
export const DEFAULT_TENANT_SETTINGS: TenantSettings = {
  features: {},
  branding: {},
  notifications: {
    emailEnabled: true,
    pushEnabled: true,
  },
  attendance: {
    autoCheckoutEnabled: true,
    autoCheckoutTimeHour: 23,
    gracePeriodMinutes: 15,
    requireGps: true,
    requireGeofence: false,
    allowManualEntry: true,
  },
  payroll: {
    payrollDayOfMonth: 25,
    currency: 'USD',
    payslipEmailEnabled: true,
  },
  metadata: {},
};