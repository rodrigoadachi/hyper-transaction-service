import { UuidVO } from '../../../../shared/domain/value-objects/uuid.vo';
import { MoneyVO } from '../value-objects/money.vo';
import { TransactionStatus } from '../value-objects/transaction-status.vo';
import type { TransactionSource } from '../value-objects/transaction-source.vo';

export interface CreateTransactionParams {
  readonly tenantId: string;
  readonly idempotencyKey: string;
  readonly amountInCents: number;
  readonly currency: string;
  readonly source: TransactionSource;
  readonly description?: string | null;
  readonly externalRef?: string | null;
  readonly metadata?: Record<string, unknown> | null;
}

export interface ReconstituteTransactionParams {
  readonly id: string;
  readonly tenantId: string;
  readonly idempotencyKey: string;
  readonly amountInCents: number;
  readonly currency: string;
  readonly source: TransactionSource;
  readonly description: string | null;
  readonly status: TransactionStatus;
  readonly externalRef: string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly processedAt: Date | null;
}

export class TransactionEntity {
  private constructor(
    readonly id: UuidVO,
    readonly tenantId: string,
    readonly idempotencyKey: string,
    readonly amountInCents: number,
    readonly currency: string,
    readonly source: TransactionSource,
    readonly description: string | null,
    readonly status: TransactionStatus,
    readonly externalRef: string | null,
    readonly metadata: Record<string, unknown> | null,
    readonly createdAt: Date,
    readonly updatedAt: Date,
    readonly processedAt: Date | null,
  ) {}

  static create(params: CreateTransactionParams): TransactionEntity {
    // Domain validation via MoneyVO — throws Error with descriptive message if invalid
    const money = MoneyVO.of(params.amountInCents, params.currency);
    const now = new Date();

    return new TransactionEntity(
      UuidVO.generate(),
      params.tenantId,
      params.idempotencyKey,
      money.amountInCents,
      money.currency,
      params.source,
      params.description ?? null,
      TransactionStatus.PENDING,
      params.externalRef ?? null,
      params.metadata ?? null,
      now,
      now,
      null,
    );
  }

  static reconstitute(params: ReconstituteTransactionParams): TransactionEntity {
    return new TransactionEntity(
      UuidVO.fromString(params.id),
      params.tenantId,
      params.idempotencyKey,
      params.amountInCents,
      params.currency,
      params.source,
      params.description,
      params.status,
      params.externalRef,
      params.metadata,
      params.createdAt,
      params.updatedAt,
      params.processedAt,
    );
  }
}
