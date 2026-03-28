// src/modules/auth/controllers/auth.controller.ts

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../services/auth.service';
import { PasswordResetService } from '../services/password-reset.service';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { Public } from '../decorators/public.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';
import { createSuccessResponse } from '../../../common/types/api-response.types';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  /**
   * POST /api/v1/auth/login
   *
   * Authenticate with email + password + tenant.
   * Returns access token + refresh token.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const result = await this.authService.login(dto, ipAddress, userAgent);

    return createSuccessResponse(result);
  }

  /**
   * POST /api/v1/auth/register
   *
   * Register a new user account.
   * NOTE: In production, registration is typically via admin invitation.
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return createSuccessResponse(result);
  }

  /**
   * POST /api/v1/auth/refresh
   *
   * Refresh the access token using a valid refresh token.
   * The old refresh token is revoked and a new one is issued (rotation).
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const tokens = await this.authService.refreshTokens(
      dto.refreshToken,
      ipAddress,
      userAgent,
    );

    return createSuccessResponse(tokens);
  }

  /**
   * POST /api/v1/auth/logout
   *
   * Revoke all refresh tokens for the current user in the current tenant.
   * Requires authentication.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: JwtPayload) {
    await this.authService.logout(user.sub, user.tenantId);
    return createSuccessResponse({ message: 'Logged out successfully.' });
  }

  /**
   * POST /api/v1/auth/change-password
   *
   * Change the password for the currently authenticated user.
   * Requires current password verification.
   * Revokes all refresh tokens (force re-login on all devices).
   */
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(
      user.sub,
      user.tenantId,
      dto,
    );

    return createSuccessResponse({
      message: 'Password changed successfully. Please log in again.',
    });
  }

  /**
   * POST /api/v1/auth/forgot-password
   *
   * Initiate a password reset. Sends a reset token via email.
   * Always returns success (prevents email enumeration).
   */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    const result = await this.passwordResetService.forgotPassword(dto.email);
    return createSuccessResponse(result);
  }

  /**
   * POST /api/v1/auth/reset-password
   *
   * Reset password using a valid reset token.
   * Revokes all refresh tokens.
   */
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.passwordResetService.resetPassword(
      dto.token,
      dto.newPassword,
    );

    return createSuccessResponse({
      message: 'Password has been reset successfully. Please log in.',
    });
  }
}
