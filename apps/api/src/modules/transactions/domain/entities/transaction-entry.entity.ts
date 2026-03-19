import { UuidVO } from '../../../../shared/domain/value-objects/uuid.vo';
import type { TransactionEntryType } from '../value-objects/transaction-entry-type.vo';

export interface CreateTransactionEntryParams {
  readonly transactionId: string;
  readonly type: TransactionEntryType;
  readonly amountInCents: number;
  readonly description?: string | null;
}

export interface ReconstituteTransactionEntryParams {
  readonly id: string;
  readonly transactionId: string;
  readonly type: TransactionEntryType;
  readonly amountInCents: number;
  readonly description: string | null;
  readonly createdAt: Date;
}

export class TransactionEntryEntity {
  private constructor(
    readonly id: UuidVO,
    readonly transactionId: string,
    readonly type: TransactionEntryType,
    readonly amountInCents: number,
    readonly description: string | null,
    readonly createdAt: Date,
  ) {}

  static create(params: CreateTransactionEntryParams): TransactionEntryEntity {
    return new TransactionEntryEntity(
      UuidVO.generate(),
      params.transactionId,
      params.type,
      params.amountInCents,
      params.description ?? null,
      new Date(),
    );
  }

  static reconstitute(params: ReconstituteTransactionEntryParams): TransactionEntryEntity {
    return new TransactionEntryEntity(
      UuidVO.fromString(params.id),
      params.transactionId,
      params.type,
      params.amountInCents,
      params.description,
      params.createdAt,
    );
  }
}
