import { TenantContext } from '../tenant.context';

describe('TenantContext', () => {
  afterEach(() => {
    // لا حاجة لتنظيف خاص
  });

  it('should throw when accessed outside a run block', () => {
    expect(() => TenantContext.currentTenantId).toThrow(
      'Tenant context is not set',
    );
  });

  it('should return the tenant ID inside a run block', async () => {
    const result = await TenantContext.run({ tenantId: 'test-123' }, async () => {
      return TenantContext.currentTenantId;
    });
    expect(result).toBe('test-123');
  });

  it('should allow nested run blocks (override)', async () => {
    const result = await TenantContext.run({ tenantId: 'outer' }, async () => {
      const inner = await TenantContext.run({ tenantId: 'inner' }, async () => {
        return TenantContext.currentTenantId;
      });
      const outer = TenantContext.currentTenantId;
      return { inner, outer };
    });
    expect(result).toEqual({ inner: 'inner', outer: 'outer' });
  });

  it('should return undefined for getTenantId() when no context', () => {
    expect(TenantContext.getTenantId()).toBeUndefined();
  });

  it('should return the correct tenant timezone if provided', async () => {
    const result = await TenantContext.run(
      { tenantId: 'test', tenantTimezone: 'Asia/Riyadh' },
      () => TenantContext.getTenantTimezone(),
    );
    expect(result).toBe('Asia/Riyadh');
  });
});
