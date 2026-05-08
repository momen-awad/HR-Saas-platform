// src/modules/auth/services/auth.service.ts

import {
  Injectable,
  Logger,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { INJECTION_TOKENS } from '../../../common/constants/injection-tokens';
import type { DrizzleDatabase } from '../../../database/database.providers';
import { tenants } from '../../../database/schema/tenants';
import { UserRepository } from '../repositories/user.repository';
import { TokenService } from './token.service';
import { EventBusService } from '../../../common/events/event-bus.service';
import { HashUtil } from '../../../common/utils/hash.util';
import { APP_CONSTANTS } from '../../../common/constants/app.constants';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import {
  LoginResponse,
  AuthTokens,
  AuthUserInfo,
} from '../interfaces/auth-tokens.interface';
import { UserLoginEvent } from '../events/user-login.event';
import { LoginFailedEvent } from '../events/login-failed.event';
import { PasswordChangedEvent } from '../events/password-changed.event';
import {
  InvalidCredentialsException,
  AccountLockedException,
} from '../../../common/exceptions/business-exceptions';
import { RbacService } from '../../rbac/services/rbac.service';
import { EmployeeFacade } from '../../employee/facades/employee.facade';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userRepo: UserRepository,
    private readonly tokenService: TokenService,
    private readonly eventBus: EventBusService,
    private readonly rbacService: RbacService,
    private readonly employeeFacade: EmployeeFacade,
    @Inject(INJECTION_TOKENS.DRIZZLE)
    private readonly db: DrizzleDatabase,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // LOGIN
  // ─────────────────────────────────────────────────────────────────────────

  async login(
    dto: LoginDto,
    ipAddress: string,
    userAgent: string,
  ): Promise<LoginResponse> {
    // 1. Find user by email
    const user = await this.userRepo.findByEmail(dto.email);
    if (!user) {
      await this.emitLoginFailed(dto.email, null, ipAddress, 'user_not_found');
      throw new InvalidCredentialsException();
    }

    // 2. Account must be active
    if (!user.isActive) {
      await this.emitLoginFailed(dto.email, user.id, ipAddress, 'account_inactive');
      throw new ForbiddenException(
        'Account is deactivated. Contact your administrator.',
      );
    }

    // 3. Brute-force lockout check
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.emitLoginFailed(dto.email, user.id, ipAddress, 'account_locked');
      throw new AccountLockedException(user.lockedUntil);
    }

    // 4. Password verification
    const isPasswordValid = await HashUtil.verifyPassword(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      await this.handleFailedLogin(user.id, dto.email, ipAddress);
      throw new InvalidCredentialsException();
    }

    // 5. Validate tenant is active
    const tenant = await this.validateTenant(dto.tenantId);

    // 6. Resolve employee context via EmployeeFacade
    //    This replaces the previous placeholder that used userId as employeeId.
    const employeeContext = await this.employeeFacade.resolveEmployeeContext(
      user.id,
      dto.tenantId,
    );

    if (!employeeContext) {
      // User has no employee profile in this tenant
      await this.emitLoginFailed(
        dto.email,
        user.id,
        ipAddress,
        'no_employee_in_tenant',
      );
      throw new UnauthorizedException(
        'No employee profile found for this tenant. Contact your administrator.',
      );
    }

    // 7. Employee must not be suspended or terminated
    if (
      employeeContext.status === 'suspended' ||
      employeeContext.status === 'terminated'
    ) {
      await this.emitLoginFailed(
        dto.email,
        user.id,
        ipAddress,
        `employee_${employeeContext.status}`,
      );
      throw new ForbiddenException(
        `Your employee account is ${employeeContext.status}. Contact your administrator.`,
      );
    }

    // 8. Resolve roles and permissions from RBAC
    const effective = await this.rbacService.getEffectivePermissions(
      employeeContext.employeeId,
      dto.tenantId,
    );
    const roles = effective.roles.map((r) => r.slug);
    const permissions = effective.permissions;

    // 9. Build JWT payload
    const jwtPayload: Omit<JwtPayload, 'iat' | 'exp' | 'jti'> = {
      sub: user.id,
      tenantId: dto.tenantId,
      employeeId: employeeContext.employeeId,
      roles,
      permissions,
      email: user.email,
      tz: employeeContext.timezone ?? tenant.defaultTimezone,
    };

    // 10. Issue token pair
    const tokens = await this.tokenService.generateTokenPair(
      jwtPayload,
      null,
      ipAddress,
      userAgent,
    );

    // 11. Reset failed attempts and record last login
    await this.userRepo.resetFailedAttempts(user.id);

    // 12. Emit domain event
    await this.eventBus.emitAsync(
      new UserLoginEvent(
        dto.tenantId,
        user.id,
        employeeContext.employeeId,
        ipAddress,
        userAgent,
      ),
    );

    const userInfo: AuthUserInfo = {
      userId: user.id,
      email: user.email,
      employeeId: employeeContext.employeeId,
      tenantId: dto.tenantId,
      tenantName: tenant.name,
      roles,
      timezone: employeeContext.timezone ?? tenant.defaultTimezone,
    };

    return { tokens, user: userInfo };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REGISTER
  // ─────────────────────────────────────────────────────────────────────────

  async register(dto: RegisterDto): Promise<{ userId: string; email: string }> {
    const exists = await this.userRepo.existsByEmail(dto.email);
    if (exists) {
      throw new ConflictException(
        'An account with this email already exists.',
      );
    }

    const passwordHash = await HashUtil.hashPassword(dto.password);
    const user = await this.userRepo.create({
      email: dto.email,
      passwordHash,
    });

    this.logger.log(`User registered: ${user.id} (${user.email})`);
    return { userId: user.id, email: user.email };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TOKEN REFRESH
  // ─────────────────────────────────────────────────────────────────────────

  async refreshTokens(
    rawRefreshToken: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<AuthTokens> {
    const rotated = await this.tokenService.rotateRefreshToken(
      rawRefreshToken,
      ipAddress,
      userAgent,
    );

    if (!rotated) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    const user = await this.userRepo.findById(rotated.userId);
    if (!user || !user.isActive) {
      await this.tokenService.revokeAllUserTokens(rotated.userId);
      throw new UnauthorizedException('Account is no longer active.');
    }

    const tenant = await this.validateTenant(rotated.tenantId);

    // Re-resolve employee context to pick up any status changes since last login
    const employeeContext = await this.employeeFacade.resolveEmployeeContext(
      rotated.userId,
      rotated.tenantId,
    );

    if (!employeeContext) {
      throw new UnauthorizedException(
        'Employee profile no longer exists in this tenant.',
      );
    }

    if (
      employeeContext.status === 'suspended' ||
      employeeContext.status === 'terminated'
    ) {
      throw new ForbiddenException(
        `Your employee account is ${employeeContext.status}.`,
      );
    }

    // Re-resolve permissions — picks up any role changes since last token
    const effective = await this.rbacService.getEffectivePermissions(
      employeeContext.employeeId,
      rotated.tenantId,
    );
    const roles = effective.roles.map((r) => r.slug);
    const permissions = effective.permissions;

    const jwtPayload: Omit<JwtPayload, 'iat' | 'exp' | 'jti'> = {
      sub: user.id,
      tenantId: rotated.tenantId,
      employeeId: employeeContext.employeeId,
      roles,
      permissions,
      email: user.email,
      tz: employeeContext.timezone ?? tenant.defaultTimezone,
    };

    return this.tokenService.generateTokenPair(
      jwtPayload,
      rotated.familyId,
      ipAddress,
      userAgent,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LOGOUT
  // ─────────────────────────────────────────────────────────────────────────

  async logout(userId: string, tenantId: string): Promise<void> {
    await this.tokenService.revokeAllTokens(userId, tenantId);
    this.logger.debug(
      `User logged out: ${userId} from tenant ${tenantId}`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CHANGE PASSWORD
  // ─────────────────────────────────────────────────────────────────────────

  async changePassword(
    userId: string,
    tenantId: string,
    dto: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    const isCurrentValid = await HashUtil.verifyPassword(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!isCurrentValid) {
      throw new BadRequestException('Current password is incorrect.');
    }

    const isSamePassword = await HashUtil.verifyPassword(
      dto.newPassword,
      user.passwordHash,
    );
    if (isSamePassword) {
      throw new BadRequestException(
        'New password must be different from the current password.',
      );
    }

    const newHash = await HashUtil.hashPassword(dto.newPassword);
    await this.userRepo.updatePassword(userId, newHash);

    // Revoke all refresh tokens — forces re-login on all devices
    await this.tokenService.revokeAllUserTokens(userId);

    await this.eventBus.emitAsync(
      new PasswordChangedEvent(tenantId, userId, userId, 'self_change'),
    );

    this.logger.log(`Password changed for user: ${userId}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Validate that a tenant exists and is actively accepting logins.
   */
  private async validateTenant(tenantId: string) {
    const [tenant] = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      throw new UnauthorizedException('Tenant not found.');
    }
    if (tenant.status !== 'active') {
      throw new ForbiddenException(
        `Tenant account is ${tenant.status}. Contact support.`,
      );
    }
    return tenant;
  }

  /**
   * Increment failed login counter and lock the account when threshold
   * is reached. Emits a LoginFailedEvent regardless.
   */
  private async handleFailedLogin(
    userId: string,
    email: string,
    ipAddress: string,
  ): Promise<void> {
    const attempts = await this.userRepo.incrementFailedAttempts(userId);

    if (attempts >= APP_CONSTANTS.MAX_FAILED_LOGIN_ATTEMPTS) {
      const lockedUntil = new Date(
        Date.now() + APP_CONSTANTS.LOCKOUT_DURATION_MINUTES * 60 * 1000,
      );
      await this.userRepo.lockAccount(userId, lockedUntil);
      this.logger.warn(
        `Account locked: ${userId} (${email}) after ${attempts} failed attempts. ` +
          `Locked until ${lockedUntil.toISOString()}`,
      );
    }

    await this.emitLoginFailed(email, userId, ipAddress, 'invalid_password');
  }

  /**
   * Fire-and-forget LoginFailedEvent.
   * Never throws — a failure here must not mask the real error.
   */
  private async emitLoginFailed(
    email: string,
    userId: string | null,
    ipAddress: string,
    reason: string,
  ): Promise<void> {
    try {
      await this.eventBus.emitAsync(
        new LoginFailedEvent(email, userId, ipAddress, reason),
      );
    } catch {
      // Intentionally swallowed — event emission must not affect login response
    }
  }
}
