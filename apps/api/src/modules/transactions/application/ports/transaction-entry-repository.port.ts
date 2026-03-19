import type { TransactionEntryEntity } from '../../domain/entities/transaction-entry.entity';
import type { UuidVO } from '../../../../shared/domain/value-objects/uuid.vo';

export interface ITransactionEntryRepository {
  saveMany(entries: TransactionEntryEntity[], tx?: unknown): Promise<void>;
  findByTransactionId(transactionId: UuidVO, tenantId: string): Promise<TransactionEntryEntity[]>;
}
