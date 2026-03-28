// src/modules/auth/services/password-reset.service.ts

import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, gt } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { INJECTION_TOKENS } from '../../../common/constants/injection-tokens';
import type { DrizzleDatabase } from '../../../database/database.providers';
import {
  passwordResetTokens,
} from '../../../database/schema/password-reset-tokens';
import { UserRepository } from '../repositories/user.repository';
import { TokenService } from './token.service';
import { EventBusService } from '../../../common/events/event-bus.service';
import { HashUtil } from '../../../common/utils/hash.util';
import { PasswordChangedEvent } from '../events/password-changed.event';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly TOKEN_EXPIRY_HOURS = 1;

  constructor(
    @Inject(INJECTION_TOKENS.DRIZZLE)
    private readonly db: DrizzleDatabase,
    private readonly userRepo: UserRepository,
    private readonly tokenService: TokenService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Initiate a password reset.
   * Generates a token and returns it (in production, this would be sent via email).
   *
   * IMPORTANT: Always return success, even if email not found.
   * This prevents email enumeration attacks.
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.userRepo.findByEmail(email);

    if (!user) {
      // Don't reveal that the email doesn't exist
      this.logger.debug(`Password reset requested for unknown email: ${email}`);
      return {
        message:
          'If an account with that email exists, a password reset link has been sent.',
      };
    }

    if (!user.isActive) {
      this.logger.debug(
        `Password reset requested for inactive account: ${email}`,
      );
      return {
        message:
          'If an account with that email exists, a password reset link has been sent.',
      };
    }

    // Generate reset token
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = HashUtil.sha256(rawToken);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.TOKEN_EXPIRY_HOURS);

    // Store token hash
    await this.db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    // TODO (Module 8): Send email via notification system
    // await this.notificationService.sendPasswordResetEmail(user.email, rawToken);

    // For development: log the token (NEVER in production)
    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(
        `DEV ONLY — Password reset token for ${email}: ${rawToken}`,
      );
    }

    return {
      message:
        'If an account with that email exists, a password reset link has been sent.',
    };
  }

  /**
   * Reset password using a valid reset token.
   */
  async resetPassword(
    rawToken: string,
    newPassword: string,
  ): Promise<void> {
    const tokenHash = HashUtil.sha256(rawToken);

    // Find valid, unused, non-expired token
    const result = await this.db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          eq(passwordResetTokens.isUsed, false),
          gt(passwordResetTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);

    const resetToken = result[0];

    if (!resetToken) {
      throw new BadRequestException(
        'Invalid or expired password reset token.',
      );
    }

    // Hash new password
    const passwordHash = await HashUtil.hashPassword(newPassword);

    // Update password
    await this.userRepo.updatePassword(resetToken.userId, passwordHash);

    // Mark token as used
    await this.db
      .update(passwordResetTokens)
      .set({
        isUsed: true,
        usedAt: new Date(),
      })
      .where(eq(passwordResetTokens.id, resetToken.id));

    // Revoke all refresh tokens (force re-login)
    await this.tokenService.revokeAllUserTokens(resetToken.userId);

    // Emit event
    await this.eventBus.emitAsync(
      new PasswordChangedEvent(
        '', // No tenant context for password reset
        resetToken.userId,
        resetToken.userId,
        'reset',
      ),
    );

    this.logger.log(`Password reset completed for user: ${resetToken.userId}`);
  }
}
