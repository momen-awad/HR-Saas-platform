import { Injectable, Inject } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { INJECTION_TOKENS } from '../../../common/constants/injection-tokens';
import type { DrizzleDatabase } from '../../../database/database.providers';
import { users, User, NewUser } from '../../../database/schema/users';

@Injectable()
export class UserRepository {
  constructor(
    @Inject(INJECTION_TOKENS.DRIZZLE)
    private readonly db: DrizzleDatabase,
  ) {}

  async findById(id: string): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return result[0] || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);
    return result[0] || null;
  }

  async create(data: NewUser): Promise<User> {
    const [user] = await this.db
      .insert(users)
      .values({
        ...data,
        email: data.email.toLowerCase().trim(),
      })
      .returning();
    return user;
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        passwordHash,
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      })
      .where(eq(users.id, userId));
  }

  async incrementFailedAttempts(userId: string): Promise<number> {
    const result = await this.db.execute(
      sql`UPDATE users 
          SET failed_login_attempts = failed_login_attempts + 1 
          WHERE id = ${userId} 
          RETURNING failed_login_attempts`,
    );
    return (result.rows[0] as any)?.failed_login_attempts || 0;
  }

  async lockAccount(userId: string, lockedUntil: Date): Promise<void> {
    await this.db
      .update(users)
      .set({ lockedUntil })
      .where(eq(users.id, userId));
  }

  async resetFailedAttempts(userId: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, userId));
  }

  async existsByEmail(email: string): Promise<boolean> {
    const result = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);
    return result.length > 0;
  }
}
