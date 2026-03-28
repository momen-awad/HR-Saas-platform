// src/modules/rbac/dto/create-role.dto.ts

import {
  IsString,
  IsOptional,
  IsArray,
  ArrayMinSize,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message:
      'Slug must start with a lowercase letter and contain only lowercase letters, numbers, and underscores',
  })
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'A role must have at least one permission' })
  @IsString({ each: true })
  permissionCodes: string[];
}