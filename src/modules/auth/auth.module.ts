// src/modules/auth/auth.module.ts

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms'; // ✅ مهم لحل expiresIn type

// Controllers
import { AuthController } from './controllers/auth.controller';

// Services
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';
import { PasswordResetService } from './services/password-reset.service';

// Repositories
import { UserRepository } from './repositories/user.repository';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';

// Strategy & Guard
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),

    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');

        // 🔥 Fail fast لو مش موجود
        if (!secret) {
          throw new Error('JWT_SECRET is not defined');
        }

        return {
          secret,
          signOptions: {
            expiresIn: configService.get<string>('JWT_EXPIRES_IN', '15m') as StringValue,
          },
        };
      },
    }),
  ],

  controllers: [AuthController],

  providers: [
    // Services
    AuthService,
    TokenService,
    PasswordResetService,

    // Repositories
    UserRepository,
    RefreshTokenRepository,

    // Auth infrastructure
    JwtStrategy,
    JwtAuthGuard,
  ],

  exports: [
    AuthService,
    TokenService,
    UserRepository,
    JwtAuthGuard,
    JwtStrategy,
  ],
})
export class AuthModule {}
