import { IdempotencyCleanupScheduler } from './idempotency-cleanup.scheduler';
import { TRANSACTION_JOB_NAMES } from './transactions-queue.constants';

const makeMockQueue = () => ({
  add: jest.fn().mockResolvedValue(undefined),
});

describe('IdempotencyCleanupScheduler', () => {
  let scheduler: IdempotencyCleanupScheduler;
  let queue: ReturnType<typeof makeMockQueue>;

  beforeEach(() => {
    queue = makeMockQueue();
    scheduler = new IdempotencyCleanupScheduler(queue as never);
  });

  it('should schedule the idempotency cleanup recurring job on init', async () => {
    await scheduler.onModuleInit();

    expect(queue.add).toHaveBeenCalledWith(
      TRANSACTION_JOB_NAMES.IDEMPOTENCY_CLEANUP,
      {},
      expect.objectContaining({
        jobId: 'idempotency-cleanup-recurring',
        repeat: { every: 10 * 60 * 1000 },
      }),
    );
  });
});
