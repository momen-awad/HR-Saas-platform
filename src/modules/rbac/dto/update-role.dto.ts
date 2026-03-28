// src/modules/rbac/dto/update-role.dto.ts

import {
  IsString,
  IsOptional,
  IsArray,
  ArrayMinSize,
  MaxLength,
} from 'class-validator';

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  permissionCodes?: string[];
}