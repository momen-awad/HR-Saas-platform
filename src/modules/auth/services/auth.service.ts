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
import { RbacService } from '../../rbac/services/rbac.service';   // <-- إضافة RBAC

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userRepo: UserRepository,
    private readonly tokenService: TokenService,
    private readonly eventBus: EventBusService,
    private readonly rbacService: RbacService,                   // <-- حقن RbacService
    @Inject(INJECTION_TOKENS.DRIZZLE)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * Authenticate a user and issue tokens.
   */
  async login(
    dto: LoginDto,
    ipAddress: string,
    userAgent: string,
  ): Promise<LoginResponse> {
    // Step 1: Find user
    const user = await this.userRepo.findByEmail(dto.email);
    if (!user) {
      await this.emitLoginFailed(dto.email, null, ipAddress, 'user_not_found');
      throw new InvalidCredentialsException();
    }

    // Step 2: Check account status
    if (!user.isActive) {
      await this.emitLoginFailed(dto.email, user.id, ipAddress, 'account_inactive');
      throw new ForbiddenException('Account is deactivated. Contact your administrator.');
    }

    // Check lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.emitLoginFailed(dto.email, user.id, ipAddress, 'account_locked');
      throw new AccountLockedException(user.lockedUntil);
    }

    // Step 3: Verify password
    const isPasswordValid = await HashUtil.verifyPassword(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      await this.handleFailedLogin(user.id, dto.email, ipAddress);
      throw new InvalidCredentialsException();
    }

    // Step 4: Validate tenant
    const tenant = await this.validateTenant(dto.tenantId);

    // Step 5: Resolve employee context
    // SIMPLIFIED: Until Module 3.2 (Employee Profiles) is built,
    // we use the user ID as a placeholder for employee ID.
    const employeeContext = await this.resolveEmployeeContext(user.id, dto.tenantId);

    // Step 6: Get effective permissions and roles from RBAC
    const effective = await this.rbacService.getEffectivePermissions(
      employeeContext.employeeId,
      dto.tenantId,
    );
    const roles = effective.roles.map(r => r.slug);
    const permissions = effective.permissions;

    // Step 7: Build JWT payload
    const jwtPayload: Omit<JwtPayload, 'iat' | 'exp' | 'jti'> = {
      sub: user.id,
      tenantId: dto.tenantId,
      employeeId: employeeContext.employeeId,
      roles,
      permissions,           // <-- تضمين الصلاحيات
      email: user.email,
      tz: employeeContext.timezone || tenant.defaultTimezone,
    };

    // Step 8: Generate token pair
    const tokens = await this.tokenService.generateTokenPair(
      jwtPayload,
      null, // new family (new login)
      ipAddress,
      userAgent,
    );

    // Step 9: Reset failed attempts and update last login
    await this.userRepo.resetFailedAttempts(user.id);

    // Step 10: Emit login event
    await this.eventBus.emitAsync(
      new UserLoginEvent(
        dto.tenantId,
        user.id,
        employeeContext.employeeId,
        ipAddress,
        userAgent,
      ),
    );

    // Build user info response
    const userInfo: AuthUserInfo = {
      userId: user.id,
      email: user.email,
      employeeId: employeeContext.employeeId,
      tenantId: dto.tenantId,
      tenantName: tenant.name,
      roles,
      timezone: employeeContext.timezone || tenant.defaultTimezone,
    };

    return { tokens, user: userInfo };
  }

  /**
   * Register a new user account.
   */
  async register(dto: RegisterDto): Promise<{ userId: string; email: string }> {
    const exists = await this.userRepo.existsByEmail(dto.email);
    if (exists) {
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await HashUtil.hashPassword(dto.password);
    const user = await this.userRepo.create({
      email: dto.email,
      passwordHash,
    });

    this.logger.log(`User registered: ${user.id} (${user.email})`);
    return { userId: user.id, email: user.email };
  }

  /**
   * Refresh an access token using a refresh token.
   */
  async refreshTokens(
    rawRefreshToken: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<AuthTokens> {
    const result = await this.tokenService.rotateRefreshToken(
      rawRefreshToken,
      ipAddress,
      userAgent,
    );

    if (!result) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    const user = await this.userRepo.findById(result.userId);
    if (!user || !user.isActive) {
      await this.tokenService.revokeAllUserTokens(result.userId);
      throw new UnauthorizedException('Account is no longer active.');
    }

    const tenant = await this.validateTenant(result.tenantId);
    const employeeContext = await this.resolveEmployeeContext(result.userId, result.tenantId);

    // Fetch latest permissions and roles (may have changed)
    const effective = await this.rbacService.getEffectivePermissions(
      employeeContext.employeeId,
      result.tenantId,
    );
    const roles = effective.roles.map(r => r.slug);
    const permissions = effective.permissions;

    const jwtPayload: Omit<JwtPayload, 'iat' | 'exp' | 'jti'> = {
      sub: user.id,
      tenantId: result.tenantId,
      employeeId: employeeContext.employeeId,
      roles,
      permissions,
      email: user.email,
      tz: employeeContext.timezone || tenant.defaultTimezone,
    };

    // Use the familyId from the rotated token
    return this.tokenService.generateTokenPair(
      jwtPayload,
      result.familyId,
      ipAddress,
      userAgent,
    );
  }

  /**
   * Logout — revoke all refresh tokens for user in current tenant.
   */
  async logout(userId: string, tenantId: string): Promise<void> {
    await this.tokenService.revokeAllTokens(userId, tenantId);
    this.logger.debug(`User logged out: ${userId} from tenant ${tenantId}`);
  }

  /**
   * Change password for the currently authenticated user.
   */
  async changePassword(
    userId: string,
    tenantId: string,
    dto: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    const isCurrentValid = await HashUtil.verifyPassword(dto.currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new BadRequestException('Current password is incorrect.');
    }

    const isSamePassword = await HashUtil.verifyPassword(dto.newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new BadRequestException('New password must be different from the current password.');
    }

    const newHash = await HashUtil.hashPassword(dto.newPassword);
    await this.userRepo.updatePassword(userId, newHash);
    await this.tokenService.revokeAllUserTokens(userId);

    await this.eventBus.emitAsync(
      new PasswordChangedEvent(tenantId, userId, userId, 'self_change'),
    );

    this.logger.log(`Password changed for user: ${userId}`);
  }

  // ── Private Helpers ──

  /**
   * Validate that the target tenant exists and is active.
   */
  private async validateTenant(tenantId: string) {
    const result = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    const tenant = result[0];
    if (!tenant) {
      throw new UnauthorizedException('Tenant not found.');
    }
    if (tenant.status !== 'active') {
      throw new ForbiddenException(`Tenant account is ${tenant.status}. Contact support.`);
    }
    return tenant;
  }

  /**
   * Resolve employee context within a tenant.
   * SIMPLIFIED VERSION — will be replaced when Module 3.2 is built.
   */
  private async resolveEmployeeContext(
    userId: string,
    tenantId: string,
  ): Promise<{ employeeId: string; timezone: string | null }> {
    // Placeholder: use userId as employeeId
    return {
      employeeId: userId,
      timezone: null,
    };
  }

  /**
   * Handle a failed login attempt.
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
        `Account locked: ${userId} (${email}) after ${attempts} failed attempts. Locked until ${lockedUntil.toISOString()}`,
      );
    }
    await this.emitLoginFailed(email, userId, ipAddress, 'invalid_password');
  }

  /**
   * Emit login failure event.
   */
  private async emitLoginFailed(
    email: string,
    userId: string | null,
    ipAddress: string,
    reason: string,
  ): Promise<void> {
    try {
      await this.eventBus.emitAsync(new LoginFailedEvent(email, userId, ipAddress, reason));
    } catch {
      // Don't let event emission failure affect the login response
    }
  }
}
