import { Inject, Injectable, Logger } from '@nestjs/common';
import { TRANSACTION_TOKENS } from '../../transactions.tokens';
import { TransactionEntity } from '../../domain/entities/transaction.entity';
import { TransactionEntryEntity } from '../../domain/entities/transaction-entry.entity';
import { TransactionStatus } from '../../domain/value-objects/transaction-status.vo';
import { TransactionSource } from '../../domain/value-objects/transaction-source.vo';
import { TransactionEntryType } from '../../domain/value-objects/transaction-entry-type.vo';
import { TENANT_REVENUE_RATIO } from '../../domain/constants/split.constants';
import { IdempotencyConflictError, NotFoundError } from '../../../../shared/domain/errors';
import { UuidVO } from '../../../../shared/domain/value-objects/uuid.vo';
import type { ITransactionRepository } from '../ports/transaction-repository.port';
import type { IIdempotencyRepository } from '../ports/idempotency-repository.port';
import type { ITransactionEntryRepository } from '../ports/transaction-entry-repository.port';
import type { ITransactionEventPublisher } from '../ports/transaction-event-publisher.port';
import type { ITransactionCacheService } from '../ports/transaction-cache.port';

export interface CreateTransactionInput {
  readonly tenantId: string;
  readonly idempotencyKey: string;
  readonly amountInCents: number;
  readonly currency: string;
  readonly source: string;
  readonly description?: string;
  readonly externalRef?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface CreateTransactionOutput {
  readonly transaction: TransactionEntity;
  readonly idempotent: boolean;
}

@Injectable()
export class CreateTransactionUseCase {
  private readonly logger = new Logger(CreateTransactionUseCase.name);

  constructor(
    @Inject(TRANSACTION_TOKENS.TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
    @Inject(TRANSACTION_TOKENS.IDEMPOTENCY_REPOSITORY)
    private readonly idempotencyRepository: IIdempotencyRepository,
    @Inject(TRANSACTION_TOKENS.TRANSACTION_ENTRY_REPOSITORY)
    private readonly entryRepository: ITransactionEntryRepository,
    @Inject(TRANSACTION_TOKENS.TRANSACTION_EVENT_PUBLISHER)
    private readonly eventPublisher: ITransactionEventPublisher,
    @Inject(TRANSACTION_TOKENS.TRANSACTION_CACHE_SERVICE)
    private readonly cacheService: ITransactionCacheService,
  ) {}

  async execute(input: CreateTransactionInput): Promise<CreateTransactionOutput> {
    const start = Date.now();

    if (!Object.values(TransactionSource).includes(input.source as TransactionSource)) {
      throw new NotFoundError(`Invalid transaction source: "${input.source}"`);
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h TTL
    const { acquired, resultId } = await this.idempotencyRepository.tryAcquire(
      input.tenantId,
      input.idempotencyKey,
      expiresAt,
    );

    if (!acquired) {
      if (resultId) {
        const existing = await this.transactionRepository.findById(
          UuidVO.fromString(resultId),
          input.tenantId,
        );
        if (!existing) throw new NotFoundError('Cached transaction not found');

        this.logger.log({
          event: 'transaction.idempotent_hit',
          transactionId: resultId,
          tenantId: input.tenantId,
          durationMs: Date.now() - start,
        });

        return { transaction: existing, idempotent: true };
      }

      throw new IdempotencyConflictError();
    }

    const transaction = TransactionEntity.create({
      tenantId: input.tenantId,
      idempotencyKey: input.idempotencyKey,
      amountInCents: input.amountInCents,
      currency: input.currency,
      source: input.source as TransactionSource,
      description: input.description,
      externalRef: input.externalRef,
      metadata: input.metadata,
    });

    try {
      await this.transactionRepository.withTransaction(async (tx) => {
        await this.transactionRepository.save(transaction, tx);

        const tenantAmount = Math.round(input.amountInCents * TENANT_REVENUE_RATIO);
        const platformAmount = input.amountInCents - tenantAmount;

        const entries: TransactionEntryEntity[] = [
          TransactionEntryEntity.create({
            transactionId: transaction.id.toString(),
            type: TransactionEntryType.TENANT_REVENUE,
            amountInCents: tenantAmount,
            description: 'Tenant revenue (90%)',
          }),
          TransactionEntryEntity.create({
            transactionId: transaction.id.toString(),
            type: TransactionEntryType.PLATFORM_FEE,
            amountInCents: platformAmount,
            description: 'Platform fee (10%)',
          }),
        ];

        await this.entryRepository.saveMany(entries, tx);
        await this.transactionRepository.updateStatus(transaction.id, input.tenantId, TransactionStatus.COMPLETED, tx);
        await this.idempotencyRepository.complete(input.tenantId, input.idempotencyKey, transaction.id.toString(), tx);
      });

      this.logger.log({
        event: 'transaction.created',
        transactionId: transaction.id.toString(),
        tenantId: input.tenantId,
        source: transaction.source,
        durationMs: Date.now() - start,
      });

      await this.eventPublisher.publishTransactionCompleted({
        transactionId: transaction.id.toString(),
        tenantId: input.tenantId,
        amountInCents: input.amountInCents,
        currency: input.currency,
        source: input.source,
      });

      await this.cacheService.invalidatePattern(`tx:list:${input.tenantId}:*`);

      return { transaction, idempotent: false };
    } catch (err) {
      await this.transactionRepository.updateStatus(transaction.id, input.tenantId, TransactionStatus.FAILED);
      await this.idempotencyRepository.fail(input.tenantId, input.idempotencyKey);

      this.logger.error({
        event: 'transaction.failed',
        transactionId: transaction.id.toString(),
        tenantId: input.tenantId,
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });

      throw err;
    }
  }
}
