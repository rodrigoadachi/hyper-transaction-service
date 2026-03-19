import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { TRANSACTION_TOKENS } from '../../transactions.tokens';
import type { IIdempotencyRepository } from '../../application/ports/idempotency-repository.port';
import type { TransactionCompletedEvent } from '../../application/ports/transaction-event-publisher.port';
import {
  TRANSACTIONS_QUEUE,
  TRANSACTION_JOB_NAMES,
} from './transactions-queue.constants';

@Processor(TRANSACTIONS_QUEUE, { concurrency: 5 })
export class TransactionEventWorker extends WorkerHost {
  private readonly logger = new Logger(TransactionEventWorker.name);

  constructor(
    @Inject(TRANSACTION_TOKENS.IDEMPOTENCY_REPOSITORY)
    private readonly idempotencyRepository: IIdempotencyRepository,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case TRANSACTION_JOB_NAMES.TRANSACTION_COMPLETED:
        await this.handleTransactionCompleted(job as Job<TransactionCompletedEvent>);
        break;

      case TRANSACTION_JOB_NAMES.IDEMPOTENCY_CLEANUP:
        await this.handleIdempotencyCleanup();
        break;

      default:
        this.logger.warn({ event: 'queue.unknown_job', jobName: job.name, jobId: job.id });
    }
  }

  private async handleTransactionCompleted(job: Job<TransactionCompletedEvent>): Promise<void> {
    const { transactionId, tenantId, amountInCents, currency, source } = job.data;

    this.logger.log({
      event: 'transaction.event.processed',
      transactionId,
      tenantId,
      amountInCents,
      currency,
      source,
      jobId: job.id,
    });

  }

  private async handleIdempotencyCleanup(): Promise<void> {
    const deleted = await this.idempotencyRepository.deleteExpired(500);
    this.logger.log({
      event: 'idempotency.cleanup.completed',
      deletedRows: deleted,
    });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error({
      event: 'queue.job_failed',
      jobName: job.name,
      jobId: job.id,
      attempt: job.attemptsMade,
      error: error.message,
    });
  }
}
