export const TRANSACTION_TOKENS = {
  TRANSACTION_REPOSITORY: Symbol('ITransactionRepository'),
  IDEMPOTENCY_REPOSITORY: Symbol('IIdempotencyRepository'),
  TRANSACTION_ENTRY_REPOSITORY: Symbol('ITransactionEntryRepository'),
  TRANSACTION_EVENT_PUBLISHER: Symbol('ITransactionEventPublisher'),
  TRANSACTION_CACHE_SERVICE: Symbol('ITransactionCacheService'),
} as const;
