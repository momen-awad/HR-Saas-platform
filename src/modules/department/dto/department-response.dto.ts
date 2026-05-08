// src/modules/department/dto/department-response.dto.ts

import { Department } from '../../../database/schema/departments';

/**
 * Flat department API response.
 * Used in list endpoints and single-resource GET.
 */
export class DepartmentResponseDto {
  id: string;
  tenantId: string;
  name: string;
  parentId: string | null;
  managerEmployeeId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;

  static fromEntity(dept: Department): DepartmentResponseDto {
    const dto = new DepartmentResponseDto();
    dto.id = dept.id;
    dto.tenantId = dept.tenantId;
    dto.name = dept.name;
    dto.parentId = dept.parentId ?? null;
    dto.managerEmployeeId = dept.managerEmployeeId ?? null;
    dto.isActive = dept.isActive;
    dto.createdAt = dept.createdAt.toISOString();
    dto.updatedAt = dept.updatedAt.toISOString();
    return dto;
  }
}

/**
 * Hierarchical department node — used for the tree endpoint.
 * Children are nested recursively.
 */
export class DepartmentTreeNodeDto {
  id: string;
  name: string;
  parentId: string | null;
  managerEmployeeId: string | null;
  isActive: boolean;
  children: DepartmentTreeNodeDto[];

  static fromEntity(
    dept: Department,
    children: DepartmentTreeNodeDto[] = [],
  ): DepartmentTreeNodeDto {
    const node = new DepartmentTreeNodeDto();
    node.id = dept.id;
    node.name = dept.name;
    node.parentId = dept.parentId ?? null;
    node.managerEmployeeId = dept.managerEmployeeId ?? null;
    node.isActive = dept.isActive;
    node.children = children;
    return node;
  }
}
