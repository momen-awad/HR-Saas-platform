// src/modules/outbox/__tests__/outbox.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { OutboxService } from '../outbox.service';
import { INJECTION_TOKENS } from '../../../common/constants/injection-tokens';
import { PG_POOL } from '../../../database/database.providers';
import { EmployeeCreatedEvent } from '../../../common/events/domain-events';

describe('OutboxService', () => {
  let service: OutboxService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockResolvedValue(undefined),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxService,
        { provide: INJECTION_TOKENS.DRIZZLE, useValue: mockDb },
        { provide: PG_POOL, useValue: {} },
      ],
    }).compile();

    service = module.get<OutboxService>(OutboxService);
  });

  it('should write event to outbox', async () => {
    const event = new EmployeeCreatedEvent(
      'tenant-1', 'user-1', 'emp-1', 'EMP001', null,
    );

    await service.writeEvent(event);

    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('should write multiple events', async () => {
    const events = [
      new EmployeeCreatedEvent('t1', 'u1', 'e1', 'E001', null),
      new EmployeeCreatedEvent('t1', 'u1', 'e2', 'E002', null),
    ];

    await service.writeEvents(events);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('should handle empty events array', async () => {
    await service.writeEvents([]);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});
