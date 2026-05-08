// src/modules/department/dto/create-department.dto.ts

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * DTO for creating a new department.
 *
 * Manager assignment is intentionally separate from creation —
 * managers must already be active employees. Use the
 * PATCH /:id/manager endpoint after both entities exist.
 */
export class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  /**
   * Optional parent department ID for hierarchical structure.
   * When null/omitted, the department is created as a top-level unit.
   */
  @IsOptional()
  @IsUUID('4', { message: 'parentId must be a valid UUID' })
  parentId?: string;
}
