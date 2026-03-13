import { Test, TestingModule } from '@nestjs/testing';
import { RlsService } from '../rls.service';
import { PG_POOL } from '../../database.providers';
import { Pool, PoolClient } from 'pg';

// Mock Pool and PoolClient
const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
} as unknown as PoolClient;

const mockPool = {
  connect: jest.fn().mockResolvedValue(mockClient),
} as unknown as Pool;

describe('RlsService', () => {
  let service: RlsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RlsService,
        {
          provide: PG_POOL,
          useValue: mockPool,
        },
      ],
    }).compile();

    service = module.get<RlsService>(RlsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should set tenant context in a transaction', async () => {
    const tenantId = '550e8400-e29b-41d4-a716-446655440000';
    const callback = jest.fn().mockResolvedValue('result');

    // Mock the query chain
    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({}) // set_config
      .mockResolvedValueOnce({}) // callback's internal queries (if any)
      .mockResolvedValueOnce({}); // COMMIT

    const result = await service.executeInTransaction(tenantId, callback);

    expect(result).toBe('result');
    expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(mockClient.query).toHaveBeenNthCalledWith(
      2,
      'SELECT set_config($1, $2, $3)',
      ['app.current_tenant', tenantId, 'true'],
    );
    expect(mockClient.query).toHaveBeenLastCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('should throw on invalid UUID', async () => {
    const invalidUuid = 'not-a-uuid';

    await expect(
      service.executeInTransaction(invalidUuid, async () => {}),
    ).rejects.toThrow('Invalid UUID format for tenant_id: not-a-uuid');
  });

  it('should executeWithTenant work without transaction', async () => {
    const tenantId = '550e8400-e29b-41d4-a716-446655440000';
    const callback = jest.fn().mockResolvedValue('result');

    mockClient.query.mockResolvedValueOnce({}); // set_config

    const result = await service.executeWithTenant(tenantId, callback);

    expect(result).toBe('result');
    expect(mockClient.query).toHaveBeenCalledWith(
      'SELECT set_config($1, $2, $3)',
      ['app.current_tenant', tenantId, 'false'],
    );
    expect(mockClient.release).toHaveBeenCalled();
  });
});
