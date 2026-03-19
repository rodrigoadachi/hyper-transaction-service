export interface ITransactionCacheService {
  /**
   * Returns the cached value for the given key, or null if not present.
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Stores a value with the given key and TTL (in seconds).
   */
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;

  /**
   * Deletes all keys matching a pattern (e.g. `tx:list:{tenantId}:*`).
   * Uses SCAN to avoid blocking Redis.
   */
  invalidatePattern(pattern: string): Promise<void>;
}
