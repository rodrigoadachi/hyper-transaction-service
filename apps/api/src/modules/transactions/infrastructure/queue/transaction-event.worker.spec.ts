import { TransactionEventWorker } from './transaction-event.worker';
import { TRANSACTION_JOB_NAMES } from './transactions-queue.constants';
import type { IIdempotencyRepository } from '../../application/ports/idempotency-repository.port';

const makeIdempotencyRepository = (): jest.Mocked<IIdempotencyRepository> => ({
  tryAcquire: jest.fn(),
  getStatus: jest.fn(),
  complete: jest.fn(),
  fail: jest.fn(),
  deleteExpired: jest.fn().mockResolvedValue(5),
});

function makeJob(name: string, data: unknown = {}, id = 'job-001') {
  return { name, data, id, attemptsMade: 1 } as never;
}

describe('TransactionEventWorker', () => {
  let worker: TransactionEventWorker;
  let idempotencyRepository: jest.Mocked<IIdempotencyRepository>;

  beforeEach(() => {
    idempotencyRepository = makeIdempotencyRepository();
    worker = new TransactionEventWorker(idempotencyRepository);
  });

  describe('process', () => {
    it('should handle transaction.completed job', async () => {
      const event = {
        transactionId: 'tx-001',
        tenantId: 'tenant-abc',
        amountInCents: 10000,
        currency: 'BRL',
        source: 'MANUAL',
      };
      const job = makeJob(TRANSACTION_JOB_NAMES.TRANSACTION_COMPLETED, event);

      await worker.process(job);

      // The handler just logs – no additional side effects to assert,
      // but it should complete without throwing.
    });

    it('should handle idempotency.cleanup job and delete expired records', async () => {
      const job = makeJob(TRANSACTION_JOB_NAMES.IDEMPOTENCY_CLEANUP);

      await worker.process(job);

      expect(idempotencyRepository.deleteExpired).toHaveBeenCalledWith(500);
    });

    it('should handle unknown job names without throwing', async () => {
      const job = makeJob('unknown.job.name');

      await expect(worker.process(job)).resolves.toBeUndefined();
    });
  });

  describe('onFailed', () => {
    it('should log job failure details without throwing', () => {
      const job = makeJob(TRANSACTION_JOB_NAMES.TRANSACTION_COMPLETED);
      const error = new Error('Something went wrong');

      expect(() => worker.onFailed(job, error)).not.toThrow();
    });
  });
});
