import { BullMqTransactionEventPublisher } from './bullmq-transaction-event.publisher';
import {
  TRANSACTIONS_QUEUE,
  TRANSACTION_JOB_NAMES,
} from './transactions-queue.constants';

const makeMockQueue = () => ({
  add: jest.fn().mockResolvedValue(undefined),
});

describe('BullMqTransactionEventPublisher', () => {
  let publisher: BullMqTransactionEventPublisher;
  let queue: ReturnType<typeof makeMockQueue>;

  beforeEach(() => {
    queue = makeMockQueue();
    publisher = new BullMqTransactionEventPublisher(queue as never);
  });

  it('should add job to queue with correct job name and options', async () => {
    const event = {
      transactionId: 'tx-001',
      tenantId: 'tenant-abc',
      amountInCents: 5000,
      currency: 'BRL',
      source: 'MANUAL',
    };

    await publisher.publishTransactionCompleted(event);

    expect(queue.add).toHaveBeenCalledWith(
      TRANSACTION_JOB_NAMES.TRANSACTION_COMPLETED,
      event,
      expect.objectContaining({
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      }),
    );
  });

  it('should use the correct queue name via TRANSACTIONS_QUEUE constant', () => {
    expect(TRANSACTIONS_QUEUE).toBe('transactions');
  });
});
