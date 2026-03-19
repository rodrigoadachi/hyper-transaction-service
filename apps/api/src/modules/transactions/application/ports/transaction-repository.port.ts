import type { TransactionEntity } from '../../domain/entities/transaction.entity';
import type { UuidVO } from '../../../../shared/domain/value-objects/uuid.vo';
import type { TransactionStatus } from '../../domain/value-objects/transaction-status.vo';
import type { TransactionSource } from '../../domain/value-objects/transaction-source.vo';

export interface ListTransactionsFilter {
  readonly page: number;
  readonly limit: number;
  readonly status?: TransactionStatus;
  readonly source?: TransactionSource;
}

export interface PaginationMeta {
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
}

export interface PaginatedResult<T> {
  readonly data: T[];
  readonly meta: PaginationMeta;
}

export interface ITransactionRepository {
  save(transaction: TransactionEntity, tx?: unknown): Promise<void>;
  findById(id: UuidVO, tenantId: string): Promise<TransactionEntity | null>;
  findAll(tenantId: string, filter: ListTransactionsFilter): Promise<PaginatedResult<TransactionEntity>>;
  updateStatus(id: UuidVO, tenantId: string, status: TransactionStatus, tx?: unknown): Promise<void>;
  withTransaction<T>(work: (tx: unknown) => Promise<T>): Promise<T>;
}
