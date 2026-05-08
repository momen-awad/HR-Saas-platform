// src/modules/employee/employee.module.ts

import { Module } from '@nestjs/common';
import { EmployeeController } from './controllers/employee.controller';
import { EmployeeSelfController } from './controllers/employee-self.controller';
import { EmployeeService } from './services/employee.service';
import { DeviceService } from './services/device.service';
import { EmployeeRepository } from './repositories/employee.repository';
import { SalaryHistoryRepository } from './repositories/salary-history.repository';
import { DeviceRepository } from './repositories/device.repository';
import { EmployeeFacade } from './facades/employee.facade';
import { DepartmentModule } from '../department/department.module';

/**
 * EmployeeModule — central business entity for the platform.
 *
 * Exports:
 *   EmployeeFacade — the ONLY interface other modules should use.
 *                    Import this; never import EmployeeService, DeviceService,
 *                    or any repository from outside this module.
 *
 * Imports:
 *   DepartmentModule — for DepartmentFacade (department validation
 *                      during employee creation/update, and manager
 *                      clearance on termination/suspension).
 *
 * Depends on (globally provided):
 *   DatabaseModule   → INJECTION_TOKENS.DRIZZLE
 *   EventBusModule   → EventBusService
 *   CommonModule     → EncryptionService
 */
@Module({
  imports: [DepartmentModule],
  controllers: [EmployeeController, EmployeeSelfController],
  providers: [
    // Services
    EmployeeService,
    DeviceService,

    // Repositories
    EmployeeRepository,
    SalaryHistoryRepository,
    DeviceRepository,

    // Facade (exported)
    EmployeeFacade,
  ],
  exports: [EmployeeFacade],
})
export class EmployeeModule {}
