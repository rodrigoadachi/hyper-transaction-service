import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TRANSACTION_TOKENS } from './transactions.tokens';
import { CreateTransactionUseCase } from './application/use-cases/create-transaction.use-case';
import { ListTransactionsUseCase } from './application/use-cases/list-transactions.use-case';
import { GetTransactionUseCase } from './application/use-cases/get-transaction.use-case';
import { DrizzleTransactionRepository } from './infrastructure/database/repositories/drizzle-transaction.repository';
import { DrizzleIdempotencyRepository } from './infrastructure/database/repositories/drizzle-idempotency.repository';
import { DrizzleTransactionEntryRepository } from './infrastructure/database/repositories/drizzle-transaction-entry.repository';
import { TransactionsController } from './infrastructure/http/transactions.controller';
import { BullMqTransactionEventPublisher } from './infrastructure/queue/bullmq-transaction-event.publisher';
import { TransactionEventWorker } from './infrastructure/queue/transaction-event.worker';
import { IdempotencyCleanupScheduler } from './infrastructure/queue/idempotency-cleanup.scheduler';
import { RedisTransactionCacheService } from './infrastructure/cache/redis-transaction-cache.service';
import { TRANSACTIONS_QUEUE } from './infrastructure/queue/transactions-queue.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: TRANSACTIONS_QUEUE }),
  ],
  providers: [
    CreateTransactionUseCase,
    ListTransactionsUseCase,
    GetTransactionUseCase,
    {
      provide: TRANSACTION_TOKENS.TRANSACTION_REPOSITORY,
      useClass: DrizzleTransactionRepository,
    },
    {
      provide: TRANSACTION_TOKENS.IDEMPOTENCY_REPOSITORY,
      useClass: DrizzleIdempotencyRepository,
    },
    {
      provide: TRANSACTION_TOKENS.TRANSACTION_ENTRY_REPOSITORY,
      useClass: DrizzleTransactionEntryRepository,
    },
    {
      provide: TRANSACTION_TOKENS.TRANSACTION_EVENT_PUBLISHER,
      useClass: BullMqTransactionEventPublisher,
    },
    {
      provide: TRANSACTION_TOKENS.TRANSACTION_CACHE_SERVICE,
      useClass: RedisTransactionCacheService,
    },
    TransactionEventWorker,
    IdempotencyCleanupScheduler,
  ],
  controllers: [TransactionsController],
})
export class TransactionsModule {}
