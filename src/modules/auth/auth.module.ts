// src/modules/auth/auth.module.ts

import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';

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

// Employee module (for EmployeeFacade used in login flow)
import { EmployeeModule } from '../employee/employee.module';

/**
 * AuthModule — handles authentication (login, token lifecycle, password).
 *
 * Imports EmployeeModule via forwardRef to avoid circular dependency:
 *   AuthModule → EmployeeModule (needs EmployeeFacade for login)
 *   EmployeeModule → DepartmentModule → (no auth dependency)
 *
 * The forwardRef is needed because NestJS resolves module imports eagerly;
 * if AuthModule and EmployeeModule are loaded in the same cycle, forwardRef
 * defers resolution until after both modules are initialised.
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),

    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET is not defined');
        }
        return {
          secret,
          signOptions: {
            expiresIn: configService.get<string>(
              'JWT_EXPIRES_IN',
              '15m',
            ) as StringValue,
          },
        };
      },
    }),

    // forwardRef breaks the potential circular dependency chain:
    // AuthModule imports EmployeeModule
    // EmployeeModule imports DepartmentModule
    // DepartmentModule imports EmployeeModule (forwardRef already there)
    forwardRef(() => EmployeeModule),
  ],

  controllers: [AuthController],

  providers: [
    AuthService,
    TokenService,
    PasswordResetService,
    UserRepository,
    RefreshTokenRepository,
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
