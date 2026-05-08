// src/modules/employee/repositories/salary-history.repository.ts

import { Injectable, Inject } from '@nestjs/common';
import { and, eq, desc } from 'drizzle-orm';
import { INJECTION_TOKENS } from '../../../common/constants/injection-tokens';
import type { DrizzleDatabase } from '../../../database/database.providers';
import {
  salaryHistory,
  SalaryHistory,
  NewSalaryHistory,
} from '../../../database/schema/salary-history';

@Injectable()
export class SalaryHistoryRepository {
  constructor(
    @Inject(INJECTION_TOKENS.DRIZZLE)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * Insert a new salary history record.
   * Records are immutable — this is the only write operation.
   */
  async create(data: NewSalaryHistory): Promise<SalaryHistory> {
    const [created] = await this.db
      .insert(salaryHistory)
      .values(data)
      .returning();
    return created;
  }

  /**
   * Fetch the complete salary history for an employee, newest first.
   */
  async findByEmployee(
    employeeId: string,
    tenantId: string,
  ): Promise<SalaryHistory[]> {
    return this.db
      .select()
      .from(salaryHistory)
      .where(
        and(
          eq(salaryHistory.tenantId, tenantId),
          eq(salaryHistory.employeeId, employeeId),
        ),
      )
      .orderBy(desc(salaryHistory.effectiveDate));
  }

  /**
   * Fetch the most recent salary record for an employee.
   * Used to determine the current salary when building payroll data.
   */
  async findLatestByEmployee(
    employeeId: string,
    tenantId: string,
  ): Promise<SalaryHistory | null> {
    const [record] = await this.db
      .select()
      .from(salaryHistory)
      .where(
        and(
          eq(salaryHistory.tenantId, tenantId),
          eq(salaryHistory.employeeId, employeeId),
        ),
      )
      .orderBy(desc(salaryHistory.effectiveDate))
      .limit(1);
    return record ?? null;
  }
}
