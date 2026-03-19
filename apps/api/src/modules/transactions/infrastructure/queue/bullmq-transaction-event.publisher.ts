import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import type {
  ITransactionEventPublisher,
  TransactionCompletedEvent,
} from '../../application/ports/transaction-event-publisher.port';
import {
  TRANSACTIONS_QUEUE,
  TRANSACTION_JOB_NAMES,
} from './transactions-queue.constants';

@Injectable()
export class BullMqTransactionEventPublisher implements ITransactionEventPublisher {
  constructor(
    @InjectQueue(TRANSACTIONS_QUEUE) private readonly queue: Queue,
  ) {}

  async publishTransactionCompleted(event: TransactionCompletedEvent): Promise<void> {
    await this.queue.add(TRANSACTION_JOB_NAMES.TRANSACTION_COMPLETED, event, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    });
  }
}
