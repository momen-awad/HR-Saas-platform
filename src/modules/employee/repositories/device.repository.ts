// src/modules/employee/repositories/device.repository.ts

import { Injectable, Inject } from '@nestjs/common';
import { and, eq, count } from 'drizzle-orm';
import { INJECTION_TOKENS } from '../../../common/constants/injection-tokens';
import type { DrizzleDatabase } from '../../../database/database.providers';
import {
  employeeDevices,
  EmployeeDevice,
  NewEmployeeDevice,
} from '../../../database/schema/employee-devices';

@Injectable()
export class DeviceRepository {
  constructor(
    @Inject(INJECTION_TOKENS.DRIZZLE)
    private readonly db: DrizzleDatabase,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────────────────

  async create(data: NewEmployeeDevice): Promise<EmployeeDevice> {
    const [created] = await this.db
      .insert(employeeDevices)
      .values(data)
      .returning();
    return created;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // READ
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Find a device record by its internal UUID (the primary key).
   * The employee must match to prevent cross-employee access.
   */
  async findById(
    id: string,
    employeeId: string,
    tenantId: string,
  ): Promise<EmployeeDevice | null> {
    const [device] = await this.db
      .select()
      .from(employeeDevices)
      .where(
        and(
          eq(employeeDevices.id, id),
          eq(employeeDevices.employeeId, employeeId),
          eq(employeeDevices.tenantId, tenantId),
        ),
      )
      .limit(1);
    return device ?? null;
  }

  /**
   * Find a device by its client-generated fingerprint string.
   * Used during registration to detect duplicates.
   * Does NOT scope by employeeId — allows detection of cross-employee conflicts.
   */
  async findByDeviceId(
    deviceId: string,
    tenantId: string,
  ): Promise<EmployeeDevice | null> {
    const [device] = await this.db
      .select()
      .from(employeeDevices)
      .where(
        and(
          eq(employeeDevices.deviceId, deviceId),
          eq(employeeDevices.tenantId, tenantId),
        ),
      )
      .limit(1);
    return device ?? null;
  }

  /**
   * List all active devices for an employee.
   * Ordered by most-recently registered first.
   */
  async findByEmployee(
    employeeId: string,
    tenantId: string,
  ): Promise<EmployeeDevice[]> {
    return this.db
      .select()
      .from(employeeDevices)
      .where(
        and(
          eq(employeeDevices.employeeId, employeeId),
          eq(employeeDevices.tenantId, tenantId),
          eq(employeeDevices.isActive, true),
        ),
      )
      .orderBy(employeeDevices.registeredAt);
  }

  /**
   * Count active devices for an employee.
   * Used to enforce the per-employee device limit.
   */
  async countActiveByEmployee(
    employeeId: string,
    tenantId: string,
  ): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(employeeDevices)
      .where(
        and(
          eq(employeeDevices.employeeId, employeeId),
          eq(employeeDevices.tenantId, tenantId),
          eq(employeeDevices.isActive, true),
        ),
      );
    return Number(result?.count ?? 0);
  }

  /**
   * Find a device by its fingerprint scoped to a specific employee.
   * Used within registration to detect per-employee duplicates.
   */
  async findByDeviceIdAndEmployee(
    deviceId: string,
    employeeId: string,
    tenantId: string,
  ): Promise<EmployeeDevice | null> {
    const [device] = await this.db
      .select()
      .from(employeeDevices)
      .where(
        and(
          eq(employeeDevices.deviceId, deviceId),
          eq(employeeDevices.employeeId, employeeId),
          eq(employeeDevices.tenantId, tenantId),
        ),
      )
      .limit(1);
    return device ?? null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────────────────────────────────

  async update(
    id: string,
    employeeId: string,
    tenantId: string,
    data: Partial<Pick<NewEmployeeDevice,
      'fcmToken' | 'deviceName' | 'isActive' | 'lastUsedAt'
    >>,
  ): Promise<EmployeeDevice | null> {
    const [updated] = await this.db
      .update(employeeDevices)
      .set(data)
      .where(
        and(
          eq(employeeDevices.id, id),
          eq(employeeDevices.employeeId, employeeId),
          eq(employeeDevices.tenantId, tenantId),
        ),
      )
      .returning();
    return updated ?? null;
  }

  /**
   * Mark the device's lastUsedAt timestamp.
   * Called by the Attendance module during check-in to track device activity.
   * Scoped only by deviceId + tenantId — the attendance module knows
   * the device fingerprint, not the internal record UUID.
   */
  async touchLastUsed(
    deviceId: string,
    tenantId: string,
  ): Promise<void> {
    await this.db
      .update(employeeDevices)
      .set({ lastUsedAt: new Date() })
      .where(
        and(
          eq(employeeDevices.deviceId, deviceId),
          eq(employeeDevices.tenantId, tenantId),
          eq(employeeDevices.isActive, true),
        ),
      );
  }

  /**
   * Deactivate all devices for an employee.
   * Called when an employee is terminated to revoke mobile access.
   */
  async deactivateAllForEmployee(
    employeeId: string,
    tenantId: string,
  ): Promise<number> {
    const result = await this.db
      .update(employeeDevices)
      .set({ isActive: false })
      .where(
        and(
          eq(employeeDevices.employeeId, employeeId),
          eq(employeeDevices.tenantId, tenantId),
          eq(employeeDevices.isActive, true),
        ),
      )
      .returning({ id: employeeDevices.id });
    return result.length;
  }
}
