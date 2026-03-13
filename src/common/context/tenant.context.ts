import { AsyncLocalStorage } from 'async_hooks';
import { InternalServerErrorException } from '@nestjs/common';

interface TenantStore {
  tenantId: string;
  tenantSlug?: string;
  tenantTimezone?: string;
  tenantStatus?: string;
}

class TenantContextClass {
  private readonly storage = new AsyncLocalStorage<TenantStore>();

  run<T>(store: TenantStore, callback: () => T): T {
    return this.storage.run(store, callback);
  }

  getStore(): TenantStore | undefined {
    return this.storage.getStore();
  }

  get currentTenantId(): string {
    const store = this.storage.getStore();
    if (!store?.tenantId) {
      throw new InternalServerErrorException(
        'Tenant context is not set. Ensure the request passes through TenantResolverMiddleware.',
      );
    }
    return store.tenantId;
  }

  getTenantId(): string | undefined {
    return this.storage.getStore()?.tenantId;
  }

  getTenantTimezone(): string | undefined {
    return this.storage.getStore()?.tenantTimezone;
  }

  getTenantStatus(): string | undefined {
    return this.storage.getStore()?.tenantStatus;
  }

  isInContext(): boolean {
    return !!this.storage.getStore()?.tenantId;
  }
}

export const TenantContext = new TenantContextClass();
