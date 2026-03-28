// src/modules/rbac/interfaces/rbac.interfaces.ts

export interface EffectivePermissions {
  employeeId: string;
  tenantId: string;
  roles: RoleSummary[];
  permissions: string[];
}

export interface RoleSummary {
  id: string;
  name: string;
  slug: string;
  isSystem: boolean;
}

export interface RoleWithPermissions {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  permissions: PermissionSummary[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PermissionSummary {
  id: string;
  code: string;
  description: string | null;
  module: string;
  category: string | null;
}