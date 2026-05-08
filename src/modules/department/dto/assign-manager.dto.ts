// src/modules/department/dto/assign-manager.dto.ts

import { IsUUID } from 'class-validator';

/**
 * DTO for assigning a manager to a department.
 *
 * The service validates that the employee:
 *   1. Exists and belongs to this tenant
 *   2. Is currently active
 */
export class AssignManagerDto {
  @IsUUID('4', { message: 'employeeId must be a valid UUID' })
  employeeId: string;
}
