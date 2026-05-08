// src/modules/employee/services/device.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { DeviceRepository } from '../repositories/device.repository';
import { TenantContext } from '../../../common/context/tenant.context';
import { RegisterDeviceDto } from '../dto/register-device.dto';
import { UpdateFcmTokenDto } from '../dto/update-fcm-token.dto';
import { DeviceResponseDto } from '../dto/device-response.dto';
import {
  ResourceNotFoundException,
  DeviceAlreadyRegisteredException,
  DeviceLimitReachedException,
  DeviceBelongsToOtherEmployeeException,
} from '../../../common/exceptions/business-exceptions';

/**
 * Maximum number of active devices per employee.
 *
 * Five devices covers the realistic maximum for any employee
 * (personal phone, work phone, tablet, kiosk, backup device).
 * This limit prevents abuse and keeps the device list manageable.
 */
const MAX_DEVICES_PER_EMPLOYEE = 5;

@Injectable()
export class DeviceService {
  private readonly logger = new Logger(DeviceService.name);

  constructor(private readonly deviceRepo: DeviceRepository) {}

  // ─────────────────────────────────────────────────────────────────────────
  // REGISTER
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Register a new device for an employee.
   *
   * Guards (in order):
   *   1. Device is not already registered to THIS employee — idempotent
   *      re-registration is allowed and updates the FCM token.
   *   2. Device is not registered to a DIFFERENT employee — prevents
   *      buddy-punching where Employee B uses Employee A's device.
   *   3. Employee has not exceeded the device limit.
   */
  async registerDevice(
    employeeId: string,
    dto: RegisterDeviceDto,
  ): Promise<DeviceResponseDto> {
    const tenantId = TenantContext.currentTenantId;

    // Check if this exact device is already registered to THIS employee
    const existingOwn = await this.deviceRepo.findByDeviceIdAndEmployee(
      dto.deviceId,
      employeeId,
      tenantId,
    );

    if (existingOwn) {
      // Idempotent re-registration: update FCM token if provided, reactivate
      // if previously deactivated. Return the updated record.
      if (existingOwn.isActive) {
        // Already active — just refresh FCM token if provided
        if (dto.fcmToken && dto.fcmToken !== existingOwn.fcmToken) {
          const updated = await this.deviceRepo.update(
            existingOwn.id,
            employeeId,
            tenantId,
            { fcmToken: dto.fcmToken },
          );
          this.logger.debug(
            `Device FCM token refreshed on re-registration: [${existingOwn.id}]`,
          );
          return DeviceResponseDto.fromEntity(updated!);
        }
        return DeviceResponseDto.fromEntity(existingOwn);
      }

      // Previously deactivated — reactivate it
      const reactivated = await this.deviceRepo.update(
        existingOwn.id,
        employeeId,
        tenantId,
        {
          isActive: true,
          fcmToken: dto.fcmToken ?? existingOwn.fcmToken,
          deviceName: dto.deviceName ?? existingOwn.deviceName,
        },
      );

      this.logger.log(
        `Device reactivated: [${existingOwn.id}] for employee [${employeeId}]`,
      );
      return DeviceResponseDto.fromEntity(reactivated!);
    }

    // Check if the same physical device is registered to a DIFFERENT employee
    const existingOther = await this.deviceRepo.findByDeviceId(
      dto.deviceId,
      tenantId,
    );
    if (existingOther && existingOther.isActive) {
      throw new DeviceBelongsToOtherEmployeeException(dto.deviceId);
    }

    // Enforce active device limit
    const activeCount = await this.deviceRepo.countActiveByEmployee(
      employeeId,
      tenantId,
    );
    if (activeCount >= MAX_DEVICES_PER_EMPLOYEE) {
      throw new DeviceLimitReachedException(activeCount, MAX_DEVICES_PER_EMPLOYEE);
    }

    // Create new device record
    const device = await this.deviceRepo.create({
      tenantId,
      employeeId,
      deviceId: dto.deviceId,
      deviceName: dto.deviceName ?? null,
      deviceOs: dto.deviceOs ?? null,
      fcmToken: dto.fcmToken ?? null,
      isActive: true,
    });

    this.logger.log(
      `Device registered: [${device.id}] for employee [${employeeId}]`,
    );

    return DeviceResponseDto.fromEntity(device);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // READ
  // ─────────────────────────────────────────────────────────────────────────

  async listDevices(employeeId: string): Promise<DeviceResponseDto[]> {
    const tenantId = TenantContext.currentTenantId;
    const devices = await this.deviceRepo.findByEmployee(employeeId, tenantId);
    return devices.map(DeviceResponseDto.fromEntity);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE FCM TOKEN
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Refresh the FCM token for a specific device.
   * FCM tokens rotate periodically — this keeps notifications working
   * without requiring the employee to fully re-register.
   */
  async updateFcmToken(
    deviceRecordId: string,
    employeeId: string,
    dto: UpdateFcmTokenDto,
  ): Promise<DeviceResponseDto> {
    const tenantId = TenantContext.currentTenantId;

    const device = await this.deviceRepo.findById(
      deviceRecordId,
      employeeId,
      tenantId,
    );
    if (!device) {
      throw new ResourceNotFoundException('Device', deviceRecordId);
    }

    const updated = await this.deviceRepo.update(
      deviceRecordId,
      employeeId,
      tenantId,
      { fcmToken: dto.fcmToken },
    );

    this.logger.debug(
      `FCM token updated for device [${deviceRecordId}]`,
    );

    return DeviceResponseDto.fromEntity(updated!);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DEACTIVATE (soft delete)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Deactivate (remove) a specific device.
   * The record is soft-deleted — it remains for attendance audit trail.
   * The operation is idempotent: deactivating an already-inactive device
   * is a no-op and returns the current state.
   */
  async deactivateDevice(
    deviceRecordId: string,
    employeeId: string,
  ): Promise<void> {
    const tenantId = TenantContext.currentTenantId;

    const device = await this.deviceRepo.findById(
      deviceRecordId,
      employeeId,
      tenantId,
    );
    if (!device) {
      throw new ResourceNotFoundException('Device', deviceRecordId);
    }

    if (!device.isActive) {
      // Idempotent — already deactivated, nothing to do
      return;
    }

    await this.deviceRepo.update(deviceRecordId, employeeId, tenantId, {
      isActive: false,
    });

    this.logger.log(
      `Device deactivated: [${deviceRecordId}] for employee [${employeeId}]`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BULK OPERATIONS (called by EmployeeService on termination)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Deactivate all devices for an employee.
   * Called when an employee is terminated to revoke mobile check-in access.
   */
  async deactivateAllForEmployee(employeeId: string): Promise<void> {
    const tenantId = TenantContext.currentTenantId;
    const count = await this.deviceRepo.deactivateAllForEmployee(
      employeeId,
      tenantId,
    );

    if (count > 0) {
      this.logger.log(
        `Deactivated ${count} device(s) for terminated employee [${employeeId}]`,
      );
    }
  }
}
