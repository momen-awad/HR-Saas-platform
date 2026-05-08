// src/modules/department/department.module.ts

import { Module, forwardRef } from '@nestjs/common';
import { DepartmentController } from './controllers/department.controller';
import { DepartmentService } from './services/department.service';
import { DepartmentRepository } from './repositories/department.repository';
import { DepartmentFacade } from './facades/department.facade';
import { EmployeeModule } from '../employee/employee.module';

/**
 * DepartmentModule — manages the organisational unit hierarchy.
 *
 * Exports:
 *   DepartmentFacade — the ONLY interface other modules should use.
 *
 * Imports:
 *   EmployeeModule (via forwardRef) — for EmployeeFacade used in the
 *   DepartmentController to validate managers and count active employees
 *   before deactivation.
 *
 *   forwardRef is required because:
 *     EmployeeModule imports DepartmentModule (for DepartmentFacade)
 *     DepartmentModule imports EmployeeModule (for EmployeeFacade)
 *   This creates a circular dependency that forwardRef resolves.
 */
@Module({
  imports: [forwardRef(() => EmployeeModule)],
  controllers: [DepartmentController],
  providers: [DepartmentService, DepartmentRepository, DepartmentFacade],
  exports: [DepartmentFacade],
})
export class DepartmentModule {}
