import {
  TRANSACTIONS_QUEUE,
  TRANSACTION_JOB_NAMES,
} from './transactions-queue.constants';

describe('transactions-queue.constants', () => {
  it('should export TRANSACTIONS_QUEUE as "transactions"', () => {
    expect(TRANSACTIONS_QUEUE).toBe('transactions');
  });

  it('should export TRANSACTION_JOB_NAMES with correct values', () => {
    expect(TRANSACTION_JOB_NAMES.TRANSACTION_COMPLETED).toBe('transaction.completed');
    expect(TRANSACTION_JOB_NAMES.IDEMPOTENCY_CLEANUP).toBe('idempotency.cleanup');
  });
});
