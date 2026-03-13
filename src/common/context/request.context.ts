import { AsyncLocalStorage } from 'async_hooks';

interface RequestStore {
  requestId: string;
  userId?: string;
  employeeId?: string;
  ip?: string;
  userAgent?: string;
}

class RequestContextClass {
  private readonly storage = new AsyncLocalStorage<RequestStore>();

  run<T>(store: RequestStore, callback: () => T): T {
    return this.storage.run(store, callback);
  }

  getStore(): RequestStore | undefined {
    return this.storage.getStore();
  }

  get requestId(): string {
    return this.storage.getStore()?.requestId || 'unknown';
  }

  get userId(): string | undefined {
    return this.storage.getStore()?.userId;
  }

  get employeeId(): string | undefined {
    return this.storage.getStore()?.employeeId;
  }

  get ip(): string | undefined {
    return this.storage.getStore()?.ip;
  }
}

export const RequestContext = new RequestContextClass();
