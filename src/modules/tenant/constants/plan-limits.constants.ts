// src/modules/tenant/constants/plan-limits.constants.ts

/**
 * Plan types and their feature/resource limits.
 *
 * These limits are enforced at the application level.
 * They can be overridden per-tenant via the tenant settings
 * (e.g., a custom enterprise deal with different limits).
 */
export const PlanTypeEnum = {
  FREE: 'free',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const;

export type PlanTypeValue = (typeof PlanTypeEnum)[keyof typeof PlanTypeEnum];

export interface PlanLimits {
  maxEmployees: number;
  maxGeofenceZones: number;
  maxDepartments: number;
  maxCustomRoles: number;
  maxCustomLeaveTypes: number;
  features: {
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
  };
}

export const PLAN_LIMITS: Record<PlanTypeValue, PlanLimits> = {
  [PlanTypeEnum.FREE]: {
    maxEmployees: 10,
    maxGeofenceZones: 1,
    maxDepartments: 3,
    maxCustomRoles: 0,
    maxCustomLeaveTypes: 0,
    features: {
      gpsTracking: true,
      geofencing: false,
      overtime: false,
      leaveManagement: true,
      payroll: false,
      customPolicies: false,
      apiAccess: false,
      webhooks: false,
      auditExport: false,
      multiCurrency: false,
    },
  },
  [PlanTypeEnum.PRO]: {
    maxEmployees: 200,
    maxGeofenceZones: 10,
    maxDepartments: 20,
    maxCustomRoles: 5,
    maxCustomLeaveTypes: 5,
    features: {
      gpsTracking: true,
      geofencing: true,
      overtime: true,
      leaveManagement: true,
      payroll: true,
      customPolicies: true,
      apiAccess: true,
      webhooks: false,
      auditExport: true,
      multiCurrency: false,
    },
  },
  [PlanTypeEnum.ENTERPRISE]: {
    maxEmployees: 50000,
    maxGeofenceZones: 100,
    maxDepartments: 500,
    maxCustomRoles: 50,
    maxCustomLeaveTypes: 20,
    features: {
      gpsTracking: true,
      geofencing: true,
      overtime: true,
      leaveManagement: true,
      payroll: true,
      customPolicies: true,
      apiAccess: true,
      webhooks: true,
      auditExport: true,
      multiCurrency: true,
    },
  },
};

/**
 * Get plan limits for a given plan type.
 * Falls back to FREE if unknown plan type.
 */
export function getPlanLimits(planType: string): PlanLimits {
  return PLAN_LIMITS[planType as PlanTypeValue] || PLAN_LIMITS[PlanTypeEnum.FREE];
}