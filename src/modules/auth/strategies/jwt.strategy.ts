// src/modules/auth/strategies/jwt.strategy.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * JWT Strategy for Passport.
 *
 * - Extracts JWT from Authorization header
 * - Validates token signature and expiration
 * - Attaches payload to request.user
 *
 * SECURITY:
 * - Fails fast if JWT_SECRET is missing
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET');

    // 🔥 Fail fast (Production-safe)
    if (!secret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /**
   * Validate JWT payload
   * This runs AFTER signature + expiration check
   */
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // 🔒 Basic claims validation
    if (!payload.sub || !payload.tenantId) {
      throw new UnauthorizedException('Invalid token claims.');
    }

    return payload;
  }
}
