// src/modules/rbac/services/permission.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PermissionRepository } from '../repositories/permission.repository';
import { Permission } from '../../../database/schema/permissions';

@Injectable()
export class PermissionService {
  private readonly logger = new Logger(PermissionService.name);

  constructor(private readonly permissionRepo: PermissionRepository) {}

  async findAll(): Promise<Permission[]> {
    return this.permissionRepo.findAll();
  }

  async findByModule(module: string): Promise<Permission[]> {
    return this.permissionRepo.findByModule(module);
  }

  async findByCodes(codes: string[]): Promise<Permission[]> {
    return this.permissionRepo.findByCodes(codes);
  }

  /**
   * Validate that all provided permission codes exist in the system.
   * Returns the list of invalid codes, or empty array if all valid.
   */
  async validatePermissionCodes(codes: string[]): Promise<string[]> {
    const existing = await this.permissionRepo.findByCodes(codes);
    const existingCodes = new Set(existing.map((p) => p.code));
    return codes.filter((code) => !existingCodes.has(code));
  }
}