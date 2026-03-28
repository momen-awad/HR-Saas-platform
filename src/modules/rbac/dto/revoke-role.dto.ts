// src/modules/rbac/dto/revoke-role.dto.ts

import { IsUUID, IsArray, ArrayMinSize } from 'class-validator';

export class RevokeRoleDto {
  @IsUUID()
  employeeId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  roleIds: string[];
}