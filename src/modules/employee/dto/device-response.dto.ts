// src/modules/employee/dto/device-response.dto.ts

import { EmployeeDevice } from '../../../database/schema/employee-devices';

/**
 * Device API response.
 *
 * FCM token is intentionally omitted — it is a sensitive push credential
 * that should not be returned in list responses. It is write-only from
 * the API perspective.
 */
export class DeviceResponseDto {
  id: string;
  employeeId: string;
  deviceId: string;
  deviceName: string | null;
  deviceOs: string | null;
  isActive: boolean;
  registeredAt: string;
  lastUsedAt: string | null;

  static fromEntity(device: EmployeeDevice): DeviceResponseDto {
    const dto = new DeviceResponseDto();
    dto.id = device.id;
    dto.employeeId = device.employeeId;
    dto.deviceId = device.deviceId;
    dto.deviceName = device.deviceName ?? null;
    dto.deviceOs = device.deviceOs ?? null;
    dto.isActive = device.isActive;
    dto.registeredAt = device.registeredAt.toISOString();
    dto.lastUsedAt = device.lastUsedAt?.toISOString() ?? null;
    return dto;
  }
}
