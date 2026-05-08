// src/modules/department/dto/update-department.dto.ts

import {
  IsString,
  IsOptional,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * DTO for updating a department's core fields.
 * All fields are optional — only provided fields are updated.
 *
 * Manager assignment uses a dedicated endpoint:
 *   PATCH /departments/:id/manager
 *
 * Deactivation uses a dedicated endpoint:
 *   PATCH /departments/:id/deactivate
 */
export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  /**
   * Set to a UUID to change the parent, or explicitly pass null
   * to promote this department to a top-level unit.
   *
   * The service validates that the new parent:
   *   1. Exists and belongs to this tenant
   *   2. Does not create a circular reference
   */
  @IsOptional()
  @IsUUID('4', { message: 'parentId must be a valid UUID' })
  parentId?: string | null;
}
