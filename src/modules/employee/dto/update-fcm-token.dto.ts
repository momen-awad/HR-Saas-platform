// src/modules/employee/dto/update-fcm-token.dto.ts

import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

/**
 * DTO for refreshing a device's FCM (Firebase Cloud Messaging) token.
 *
 * FCM tokens rotate periodically. The mobile app refreshes the token
 * without re-registering the device via PATCH /me/devices/:id/fcm-token.
 */
export class UpdateFcmTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  fcmToken: string;
}
