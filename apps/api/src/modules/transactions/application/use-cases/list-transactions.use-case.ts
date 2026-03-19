import { Inject, Injectable, Logger } from '@nestjs/common';
import { TRANSACTION_TOKENS } from '../../transactions.tokens';
import type { ITransactionRepository, PaginatedResult, ListTransactionsFilter } from '../ports/transaction-repository.port';
import type { ITransactionCacheService } from '../ports/transaction-cache.port';
import { TransactionEntity } from '../../domain/entities/transaction.entity';
import type { TransactionStatus } from '../../domain/value-objects/transaction-status.vo';
import type { TransactionSource } from '../../domain/value-objects/transaction-source.vo';

export interface ListTransactionsInput {
  readonly tenantId: string;
  readonly page: number;
  readonly limit: number;
  readonly status?: TransactionStatus;
  readonly source?: TransactionSource;
}

/** Plain serializable shape stored in Redis (no Value Object classes). */
interface CachedTransactionDto {
  id: string;
  tenantId: string;
  idempotencyKey: string;
  amountInCents: number;
  currency: string;
  source: string;
  description: string | null;
  status: string;
  externalRef: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  processedAt: string | null;
}

interface CachedResult {
  data: CachedTransactionDto[];
  meta: PaginatedResult<TransactionEntity>['meta'];
}

/** Cache TTL for list-transactions results (30 seconds). */
const CACHE_TTL_SECONDS = 30;

@Injectable()
export class ListTransactionsUseCase {
  private readonly logger = new Logger(ListTransactionsUseCase.name);

  constructor(
    @Inject(TRANSACTION_TOKENS.TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
    @Inject(TRANSACTION_TOKENS.TRANSACTION_CACHE_SERVICE)
    private readonly cacheService: ITransactionCacheService,
  ) { }

  async execute(input: ListTransactionsInput): Promise<PaginatedResult<TransactionEntity>> {
    const start = Date.now();
    const cacheKey = this.buildCacheKey(input);

    const cached = await this.cacheService.get<CachedResult>(cacheKey);
    if (cached) {
      this.logger.log({
        event: 'transaction.listed.cache_hit',
        tenantId: input.tenantId,
        page: input.page,
        durationMs: Date.now() - start,
      });
      return this.reconstituteCached(cached);
    }

    const filter: ListTransactionsFilter = {
      page: input.page,
      limit: input.limit,
      status: input.status,
      source: input.source,
    };

    const result = await this.transactionRepository.findAll(input.tenantId, filter);

    // Serialize to plain DTOs before storing — avoids Value Object deserialization issues.
    const serializable: CachedResult = {
      data: result.data.map((tx) => ({
        id: tx.id.toString(),
        tenantId: tx.tenantId,
        idempotencyKey: tx.idempotencyKey,
        amountInCents: tx.amountInCents,
        currency: tx.currency,
        source: tx.source,
        description: tx.description,
        status: tx.status,
        externalRef: tx.externalRef,
        metadata: tx.metadata,
        createdAt: tx.createdAt.toISOString(),
        updatedAt: tx.updatedAt.toISOString(),
        processedAt: tx.processedAt?.toISOString() ?? null,
      })),
      meta: result.meta,
    };
    await this.cacheService.set(cacheKey, serializable, CACHE_TTL_SECONDS);

    this.logger.log({
      event: 'transaction.listed',
      tenantId: input.tenantId,
      page: input.page,
      total: result.meta.total,
      durationMs: Date.now() - start,
    });

    return result;
  }

  private buildCacheKey(input: ListTransactionsInput): string {
    const status = input.status ?? 'all';
    const source = input.source ?? 'all';
    return `tx:list:${input.tenantId}:p${input.page}:l${input.limit}:s${status}:src${source}`;
  }

  private reconstituteCached(cached: CachedResult): PaginatedResult<TransactionEntity> {
    return {
      data: cached.data.map((dto) =>
        TransactionEntity.reconstitute({
          id: dto.id,
          tenantId: dto.tenantId,
          idempotencyKey: dto.idempotencyKey,
          amountInCents: dto.amountInCents,
          currency: dto.currency,
          source: dto.source as TransactionSource,
          description: dto.description,
          status: dto.status as TransactionStatus,
          externalRef: dto.externalRef,
          metadata: dto.metadata,
          createdAt: new Date(dto.createdAt),
          updatedAt: new Date(dto.updatedAt),
          processedAt: dto.processedAt ? new Date(dto.processedAt) : null,
        }),
      ),
      meta: cached.meta,
    };
  }
}
