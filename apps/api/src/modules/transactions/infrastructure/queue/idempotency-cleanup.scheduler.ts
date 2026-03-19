import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  TRANSACTIONS_QUEUE,
  TRANSACTION_JOB_NAMES,
} from './transactions-queue.constants';

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

@Injectable()
export class IdempotencyCleanupScheduler implements OnModuleInit {
  private readonly logger = new Logger(IdempotencyCleanupScheduler.name);

  constructor(
    @InjectQueue(TRANSACTIONS_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      TRANSACTION_JOB_NAMES.IDEMPOTENCY_CLEANUP,
      {},
      {
        repeat: { every: CLEANUP_INTERVAL_MS },
        jobId: 'idempotency-cleanup-recurring',
        removeOnComplete: { count: 5 },
        removeOnFail: { count: 5 },
      },
    );

    this.logger.log({
      event: 'idempotency.cleanup.scheduled',
      intervalMs: CLEANUP_INTERVAL_MS,
    });
  }
}
