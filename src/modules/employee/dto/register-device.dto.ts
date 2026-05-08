// src/modules/employee/dto/register-device.dto.ts

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  MaxLength,
} from 'class-validator';

/**
 * DTO for registering a new mobile device.
 *
 * The deviceId is a client-generated fingerprint — not a UUID.
 * The mobile SDK produces this from hardware + OS identifiers.
 * It uniquely identifies a physical device installation.
 */
export class RegisterDeviceDto {
  /**
   * Client-generated hardware/OS fingerprint.
   * Must be stable across app restarts on the same device.
   * Example: "ios_A1B2C3D4E5F6" or Android's ANDROID_ID.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  deviceId: string;

  /**
   * Human-readable label for the device.
   * Shown in the device list so the employee can identify it.
   * e.g., "Alice's iPhone 15 Pro"
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceName?: string;

  /**
   * Operating system of the device.
   */
  @IsOptional()
  @IsString()
  @IsIn(['ios', 'android', 'web'], {
    message: 'deviceOs must be one of: ios, android, web',
  })
  deviceOs?: string;

  /**
   * Firebase Cloud Messaging token for push notifications.
   * Optional — employee may deny notification permission.
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  fcmToken?: string;
}
