import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomUUID } from 'crypto';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { AuthTokens } from '../interfaces/auth-tokens.interface';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import { HashUtil } from '../../../common/utils/hash.util';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly accessTokenTtl: string;
  private readonly refreshTokenTtlDays: number;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly refreshTokenRepo: RefreshTokenRepository,
  ) {
    this.accessTokenTtl = this.configService.get<string>('JWT_EXPIRES_IN', '15m');
    this.refreshTokenTtlDays = parseInt(
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d').replace('d', ''),
      10,
    );
  }

  async generateTokenPair(
    payload: Omit<JwtPayload, 'iat' | 'exp' | 'jti'>,
    familyId: string | null,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthTokens> {
    const jti = randomUUID();
    const expiresInSeconds = this.parseTtlToSeconds(this.accessTokenTtl);
    const accessToken = this.jwtService.sign(
      {
        sub: payload.sub,
        tenantId: payload.tenantId,
        employeeId: payload.employeeId,
        roles: payload.roles,
        permissions: payload.permissions, 
        email: payload.email,
        tz: payload.tz,
        jti,
      },
      { expiresIn: expiresInSeconds },
    );

    const rawRefreshToken = randomBytes(40).toString('hex');
    const tokenHash = HashUtil.sha256(rawRefreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshTokenTtlDays);
    const newFamilyId = familyId || randomUUID();

    await this.refreshTokenRepo.create({
      userId: payload.sub,
      tenantId: payload.tenantId,
      tokenHash,
      familyId: newFamilyId,
      expiresAt,
      ipAddress: ipAddress || null,
      userAgent: userAgent ? userAgent.substring(0, 500) : null,
    });

    const expiresIn = this.parseTtlToSeconds(this.accessTokenTtl);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn,
      tokenType: 'Bearer',
    };
  }

  async rotateRefreshToken(
    rawRefreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ userId: string; tenantId: string; familyId: string } | null> {
    const tokenHash = HashUtil.sha256(rawRefreshToken);
    const storedToken = await this.refreshTokenRepo.findByTokenHash(tokenHash);

    if (!storedToken) {
      this.logger.warn('Refresh token not found (invalid token)');
      return null;
    }

    if (storedToken.isRevoked) {
      this.logger.error(
        `SECURITY: Refresh token reuse detected! Family: ${storedToken.familyId}, User: ${storedToken.userId}`,
      );
      await this.refreshTokenRepo.revokeFamily(storedToken.familyId, 'token_reuse_detected');
      return null;
    }

    if (storedToken.expiresAt < new Date()) {
      this.logger.debug('Refresh token expired');
      await this.refreshTokenRepo.revokeToken(storedToken.id, 'expired');
      return null;
    }

    await this.refreshTokenRepo.revokeToken(storedToken.id, 'rotated');

    return {
      userId: storedToken.userId,
      tenantId: storedToken.tenantId,
      familyId: storedToken.familyId,
    };
  }

  async revokeAllTokens(userId: string, tenantId: string): Promise<void> {
    await this.refreshTokenRepo.revokeAllForUserInTenant(userId, tenantId, 'logout');
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.refreshTokenRepo.revokeAllForUser(userId, 'account_action');
  }

  verifyAccessToken(token: string): JwtPayload | null {
    try {
      return this.jwtService.verify<JwtPayload>(token);
    } catch {
      return null;
    }
  }

  async cleanupExpiredTokens(): Promise<number> {
    return this.refreshTokenRepo.deleteExpired();
  }

  private parseTtlToSeconds(ttl: string): number {
    const match = ttl.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return 900;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 900;
    }
  }
}
