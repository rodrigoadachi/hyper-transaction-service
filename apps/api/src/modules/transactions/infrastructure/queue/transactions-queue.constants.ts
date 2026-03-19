/** Name of the BullMQ queue used for transaction-related jobs. */
export const TRANSACTIONS_QUEUE = 'transactions' as const;

/** Job names dispatched to the transactions queue. */
export const TRANSACTION_JOB_NAMES = {
  TRANSACTION_COMPLETED: 'transaction.completed',
  IDEMPOTENCY_CLEANUP: 'idempotency.cleanup',
} as const;
