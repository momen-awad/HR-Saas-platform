// src/modules/employee/controllers/employee-self.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { EmployeeService } from '../services/employee.service';
import { DeviceService } from '../services/device.service';
import { UpdateSelfProfileDto } from '../dto/update-self-profile.dto';
import { RegisterDeviceDto } from '../dto/register-device.dto';
import { UpdateFcmTokenDto } from '../dto/update-fcm-token.dto';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UuidValidationPipe } from '../../../common/pipes/uuid-validation.pipe';
import { createSuccessResponse } from '../../../common/types/api-response.types';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

/**
 * Employee self-service controller.
 *
 * Mounted at: /api/v1/employees/me
 *
 * All endpoints here scope automatically to the authenticated employee's own
 * data via user.employeeId from the JWT. Employees can never access another
 * employee's data through these endpoints.
 *
 * Permission model (all use the 'employee' system role defaults):
 *   GET  /me                → employee:view_own
 *   PATCH /me               → employee:view_own  (limited fields only)
 *   GET  /me/salary         → payroll:view_own
 *   GET  /me/devices        → employee:view_own
 *   POST /me/devices        → employee:view_own
 *   PATCH /me/devices/:id   → employee:view_own
 *   DELETE /me/devices/:id  → employee:view_own
 *
 * Note: This controller is declared at 'employees/me' (more specific prefix)
 * and NestJS registers it before the 'employees' controller. Express routing
 * matches the most specific prefix first, so 'employees/me' is correctly
 * resolved before 'employees/:id'.
 */
@Controller('employees/me')
export class EmployeeSelfController {
  private readonly logger = new Logger(EmployeeSelfController.name);

  constructor(
    private readonly employeeService: EmployeeService,
    private readonly deviceService: DeviceService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // PROFILE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the authenticated employee's own profile.
   * GET /api/v1/employees/me
   */
  @Get()
  @RequirePermissions('employee:view_own')
  async getMyProfile(@CurrentUser() user: JwtPayload) {
    const employee = await this.employeeService.getEmployeeById(
      user.employeeId,
    );
    return createSuccessResponse(employee);
  }

  /**
   * Update the authenticated employee's own preference fields.
   * PATCH /api/v1/employees/me
   *
   * Only timezone and locale may be changed via self-service.
   * All other fields require HR/admin via PUT /employees/:id.
   */
  @Patch()
  @RequirePermissions('employee:view_own')
  async updateMyProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateSelfProfileDto,
  ) {
    const employee = await this.employeeService.updateSelfProfile(
      user.employeeId,
      dto,
    );
    return createSuccessResponse(employee);
  }

  /**
   * Get the authenticated employee's current salary.
   * GET /api/v1/employees/me/salary
   */
  @Get('salary')
  @RequirePermissions('payroll:view_own')
  async getMySalary(@CurrentUser() user: JwtPayload) {
    const salary = await this.employeeService.getEmployeeSalary(
      user.employeeId,
    );
    return createSuccessResponse(salary);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DEVICES
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * List the authenticated employee's registered devices.
   * GET /api/v1/employees/me/devices
   *
   * Returns only active devices. FCM token is excluded from the response.
   */
  @Get('devices')
  @RequirePermissions('employee:view_own')
  async listMyDevices(@CurrentUser() user: JwtPayload) {
    const devices = await this.deviceService.listDevices(user.employeeId);
    return createSuccessResponse(devices);
  }

  /**
   * Register a new device for mobile GPS check-in.
   * POST /api/v1/employees/me/devices
   *
   * Idempotent: re-registering an already-registered device refreshes its
   * FCM token and reactivates it if it was previously removed.
   */
  @Post('devices')
  @RequirePermissions('employee:view_own')
  async registerDevice(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RegisterDeviceDto,
  ) {
    const device = await this.deviceService.registerDevice(
      user.employeeId,
      dto,
    );
    return createSuccessResponse(device);
  }

  /**
   * Refresh the FCM token for a registered device.
   * PATCH /api/v1/employees/me/devices/:id/fcm-token
   *
   * FCM tokens rotate periodically. The mobile app calls this endpoint
   * when it receives a new token from Firebase, without needing to
   * fully re-register the device.
   *
   * Note: :id here is the internal UUID of the device record (from
   * the response of POST /devices), not the client deviceId fingerprint.
   */
  @Patch('devices/:id/fcm-token')
  @RequirePermissions('employee:view_own')
  async updateFcmToken(
    @Param('id', UuidValidationPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateFcmTokenDto,
  ) {
    const device = await this.deviceService.updateFcmToken(
      id,
      user.employeeId,
      dto,
    );
    return createSuccessResponse(device);
  }

  /**
   * Remove a registered device.
   * DELETE /api/v1/employees/me/devices/:id
   *
   * Soft-deletes the device record. The device will no longer be able to
   * perform GPS check-in. Historical attendance records are preserved.
   *
   * Returns 204 No Content on success (idempotent).
   */
  @Delete('devices/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('employee:view_own')
  async removeDevice(
    @Param('id', UuidValidationPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.deviceService.deactivateDevice(id, user.employeeId);
  }
}
