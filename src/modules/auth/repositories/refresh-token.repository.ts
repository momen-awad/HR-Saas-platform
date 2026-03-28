// src/modules/auth/repositories/refresh-token.repository.ts

import { Injectable, Inject } from '@nestjs/common';
import { eq, and, gt, lte } from 'drizzle-orm';
import { INJECTION_TOKENS } from '../../../common/constants/injection-tokens';
import type { DrizzleDatabase } from '../../../database/database.providers';
import {
  refreshTokens,
  RefreshToken,
  NewRefreshToken,
} from '../../../database/schema/refresh-tokens';

@Injectable()
export class RefreshTokenRepository {
  constructor(
    @Inject(INJECTION_TOKENS.DRIZZLE)
    private readonly db: DrizzleDatabase,
  ) {}

  async create(data: NewRefreshToken): Promise<RefreshToken> {
    const [token] = await this.db
      .insert(refreshTokens)
      .values(data)
      .returning();
    return token;
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    const result = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);
    return result[0] || null;
  }

  async revokeToken(
    id: string,
    reason: string,
  ): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: reason,
      })
      .where(eq(refreshTokens.id, id));
  }

  /**
   * Revoke all tokens in a family.
   * Called when token reuse is detected (compromise).
   */
  async revokeFamily(familyId: string, reason: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: reason,
      })
      .where(eq(refreshTokens.familyId, familyId));
  }

  /**
   * Revoke all tokens for a user across all tenants.
   * Called when user account is deactivated or compromised.
   */
  async revokeAllForUser(userId: string, reason: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: reason,
      })
      .where(
        and(
          eq(refreshTokens.userId, userId),
          eq(refreshTokens.isRevoked, false),
        ),
      );
  }

  /**
   * Revoke all tokens for a user in a specific tenant.
   * Called on logout from a specific tenant.
   */
  async revokeAllForUserInTenant(
    userId: string,
    tenantId: string,
    reason: string,
  ): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: reason,
      })
      .where(
        and(
          eq(refreshTokens.userId, userId),
          eq(refreshTokens.tenantId, tenantId),
          eq(refreshTokens.isRevoked, false),
        ),
      );
  }

  /**
   * Clean up expired tokens.
   * Called by scheduled cleanup job.
   */
  async deleteExpired(): Promise<number> {
    const result = await this.db
      .delete(refreshTokens)
      .where(lte(refreshTokens.expiresAt, new Date()))
      .returning({ id: refreshTokens.id });
    return result.length;
  }
}
