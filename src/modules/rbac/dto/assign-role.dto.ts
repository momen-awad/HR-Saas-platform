// src/modules/rbac/dto/assign-role.dto.ts

import { IsUUID, IsArray, ArrayMinSize } from 'class-validator';

export class AssignRoleDto {
  @IsUUID()
  employeeId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  roleIds: string[];
}