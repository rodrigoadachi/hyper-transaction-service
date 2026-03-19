import { TransactionEntryEntity } from './transaction-entry.entity';
import { TransactionEntryType } from '../value-objects/transaction-entry-type.vo';

describe('TransactionEntryEntity', () => {
  describe('create', () => {
    it('should create entry with generated id and current date', () => {
      const entry = TransactionEntryEntity.create({
        transactionId: 'tx-001',
        type: TransactionEntryType.TENANT_REVENUE,
        amountInCents: 9000,
        description: 'Tenant revenue',
      });

      expect(entry.transactionId).toBe('tx-001');
      expect(entry.type).toBe(TransactionEntryType.TENANT_REVENUE);
      expect(entry.amountInCents).toBe(9000);
      expect(entry.description).toBe('Tenant revenue');
      expect(entry.id).toBeDefined();
      expect(entry.createdAt).toBeInstanceOf(Date);
    });

    it('should default description to null when not provided', () => {
      const entry = TransactionEntryEntity.create({
        transactionId: 'tx-001',
        type: TransactionEntryType.PLATFORM_FEE,
        amountInCents: 1000,
      });

      expect(entry.description).toBeNull();
    });

    it('should set description to null when explicitly null', () => {
      const entry = TransactionEntryEntity.create({
        transactionId: 'tx-001',
        type: TransactionEntryType.PLATFORM_FEE,
        amountInCents: 1000,
        description: null,
      });

      expect(entry.description).toBeNull();
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute entry from persisted params', () => {
      const createdAt = new Date('2026-01-01T00:00:00.000Z');

      const entry = TransactionEntryEntity.reconstitute({
        id: '01945cf0-0000-7000-8000-000000000001',
        transactionId: 'tx-001',
        type: TransactionEntryType.TENANT_REVENUE,
        amountInCents: 9000,
        description: 'Revenue',
        createdAt,
      });

      expect(entry.id.toString()).toBe('01945cf0-0000-7000-8000-000000000001');
      expect(entry.transactionId).toBe('tx-001');
      expect(entry.type).toBe(TransactionEntryType.TENANT_REVENUE);
      expect(entry.amountInCents).toBe(9000);
      expect(entry.description).toBe('Revenue');
      expect(entry.createdAt).toBe(createdAt);
    });

    it('should reconstitute entry with null description', () => {
      const entry = TransactionEntryEntity.reconstitute({
        id: '01945cf0-0000-7000-8000-000000000001',
        transactionId: 'tx-002',
        type: TransactionEntryType.PLATFORM_FEE,
        amountInCents: 1000,
        description: null,
        createdAt: new Date(),
      });

      expect(entry.description).toBeNull();
    });
  });
});
