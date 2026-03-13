import { Test, TestingModule } from '@nestjs/testing';
import { TenantScopedDatabase } from '../tenant-scoped.database';
import { PG_POOL } from '../database.providers';
import { TenantContext } from '../../common/context/tenant.context';
import { Pool, PoolClient } from 'pg';
import { InternalServerErrorException } from '@nestjs/common';

// Mock Pool and PoolClient
const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
} as unknown as PoolClient;

const mockPool = {
  connect: jest.fn().mockResolvedValue(mockClient),
} as unknown as Pool;

describe('TenantScopedDatabase', () => {
  let tenantDb: TenantScopedDatabase;
  const validTenantId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(async () => {
    jest.clearAllMocks();
    (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantScopedDatabase,
        {
          provide: PG_POOL,
          useValue: mockPool,
        },
      ],
    }).compile();

    tenantDb = module.get<TenantScopedDatabase>(TenantScopedDatabase);
  });

  describe('transaction', () => {
    it('should throw error if tenant context is missing', async () => {
      await expect(tenantDb.transaction(async () => {})).rejects.toThrow(
        'Tenant context is not set',
      );
    });

    it('should execute BEGIN, set_config, callback, COMMIT in order', async () => {
      const callback = jest.fn().mockResolvedValue('result');

      // Mock responses for each query
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // set_config (timeouts, tenant)
        .mockResolvedValueOnce({ rows: [{ tenant_id: validTenantId }] }) // verify (optional)
        .mockResolvedValueOnce({}) // callback's internal queries (if any)
        .mockResolvedValueOnce({}); // COMMIT

      await TenantContext.run({ tenantId: validTenantId }, async () => {
        const result = await tenantDb.transaction(callback);
        expect(result).toBe('result');
      });

      const calls = mockClient.query.mock.calls;
      expect(calls[0][0]).toBe('BEGIN');
      // البحث عن استعلام set_config
      const setConfigCall = calls.find(
        (call) => call[0] && call[0].includes('set_config') && call[0].includes('app.current_tenant')
      );
      expect(setConfigCall).toBeDefined();
      expect(setConfigCall[1]).toEqual([validTenantId, 'true']); // true = LOCAL
      expect(calls[calls.length - 1][0]).toBe('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      const error = new Error('Test error');
      const callback = jest.fn().mockRejectedValue(error);

      mockClient.query.mockResolvedValue({}); // أي استعلام

      await TenantContext.run({ tenantId: validTenantId }, async () => {
        await expect(tenantDb.transaction(callback)).rejects.toThrow(error);
      });

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('executeWithTenant', () => {
    it('should execute callback with tenant context', async () => {
      const callback = jest.fn().mockResolvedValue('result');

      mockClient.query
        .mockResolvedValueOnce({}) // set_config (session)
        .mockResolvedValueOnce({ rows: [{ tenant_id: validTenantId }] }); // verify (optional)

      await TenantContext.run({ tenantId: validTenantId }, async () => {
        const result = await tenantDb.executeWithTenant(callback);
        expect(result).toBe('result');
      });

      const setConfigCall = mockClient.query.mock.calls.find(
        (call) => call[0] && call[0].includes('set_config') && call[0].includes('app.current_tenant')
      );
      expect(setConfigCall).toBeDefined();
      expect(setConfigCall[1]).toEqual([validTenantId, 'false']); // false = session
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('UUID Validation', () => {
    it('should reject invalid UUID format', async () => {
      const invalidTenantId = 'not-a-uuid';

      await TenantContext.run({ tenantId: invalidTenantId }, async () => {
        await expect(tenantDb.transaction(async () => {})).rejects.toThrow(
          'Security violation: invalid tenant UUID format',
        );
      });
    });

    it('should reject undefined tenant ID', async () => {
      await TenantContext.run({ tenantId: undefined as any }, async () => {
        await expect(tenantDb.transaction(async () => {})).rejects.toThrow(
          'Tenant context is not set',
        );
      });
    });
  });

  describe('Bleeding Monitor', () => {
    it('should verify tenant context matches', async () => {
      const callback = jest.fn().mockResolvedValue('result');

      mockClient.query
        .mockResolvedValueOnce({}) // set_config
        .mockResolvedValueOnce({ rows: [{ tenant_id: validTenantId }] }); // verify

      await TenantContext.run({ tenantId: validTenantId }, async () => {
        await tenantDb.executeWithTenant(callback);
      });

      const verifyCall = mockClient.query.mock.calls.find(
        (call) => call[0] && call[0].includes('current_setting')
      );
      expect(verifyCall).toBeDefined();
    });
  });
});
