export interface IdempotencyAcquireResult {
  /** true if this request successfully claimed the key; false if it already existed */
  readonly acquired: boolean;
  /** ID of the already-created transaction (present only when acquired=false and processing is done) */
  readonly resultId: string | null;
}

export interface IIdempotencyRepository {
  /**
   * Atomically tries to insert the idempotency key.
   * Returns { acquired: true } if successful (first time this key is seen).
   * Returns { acquired: false, resultId } if the key already exists.
   * If the key exists with status FAILED, resets it to PROCESSING and returns { acquired: true }.
   */
  tryAcquire(tenantId: string, key: string, expiresAt: Date): Promise<IdempotencyAcquireResult>;

  /** Marks the key as COMPLETED and records the resultId (transaction ID). */
  complete(tenantId: string, key: string, resultId: string, tx?: unknown): Promise<void>;

  /** Marks the key as FAILED, allowing clients to retry with the same key. */
  fail(tenantId: string, key: string): Promise<void>;

  /**
   * Deletes expired idempotency keys in batches to avoid long-running transactions.
   * @param batchSize Maximum number of rows to delete per call. Defaults to 500.
   * @returns The number of rows deleted.
   */
  deleteExpired(batchSize?: number): Promise<number>;
}
