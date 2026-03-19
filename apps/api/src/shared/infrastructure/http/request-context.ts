import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextStore {
  correlationId: string;
  tenantId?: string;
  idempotencyKey?: string;
  transactionId?: string;
  method?: string;
  path?: string;
}

const storage = new AsyncLocalStorage<RequestContextStore>();

export const RequestContext = {
  run<T>(context: RequestContextStore, work: () => T): T {
    return storage.run(context, work);
  },

  snapshot(): Partial<RequestContextStore> {
    return storage.getStore() ?? {};
  },

  set<K extends keyof RequestContextStore>(key: K, value: RequestContextStore[K]): void {
    const store = storage.getStore();
    if (!store || value === undefined) return;
    store[key] = value;
  },
};