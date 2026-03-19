import { DrizzleTransactionEntryRepository } from './drizzle-transaction-entry.repository';
import { TransactionEntryEntity } from '../../../domain/entities/transaction-entry.entity';
import { TransactionEntryType } from '../../../domain/value-objects/transaction-entry-type.vo';
import { UuidVO } from '../../../../../shared/domain/value-objects/uuid.vo';

const TX_ID = '01945cf0-0000-7000-8000-000000000001';
const ENTRY_ID = '01945cf0-0000-7000-8000-000000000002';
const TENANT_ID = 'tenant-abc';

function makeEntry(): TransactionEntryEntity {
  return TransactionEntryEntity.reconstitute({
    id: ENTRY_ID,
    transactionId: TX_ID,
    type: TransactionEntryType.TENANT_REVENUE,
    amountInCents: 9000,
    description: 'Revenue',
    createdAt: new Date(),
  });
}

describe('DrizzleTransactionEntryRepository', () => {
  describe('saveMany', () => {
    it('should do nothing when entries array is empty', async () => {
      const db = { insert: jest.fn() } as never;
      const repo = new DrizzleTransactionEntryRepository(db);

      await repo.saveMany([]);

      expect(db.insert).not.toHaveBeenCalled();
    });

    it('should insert entries using db directly when no tx provided', async () => {
      const values = jest.fn().mockResolvedValue(undefined);
      const db = { insert: jest.fn().mockReturnValue({ values }) } as never;
      const repo = new DrizzleTransactionEntryRepository(db);

      await repo.saveMany([makeEntry()]);

      expect(db.insert).toHaveBeenCalled();
      expect(values).toHaveBeenCalled();
    });

    it('should insert entries using provided tx', async () => {
      const values = jest.fn().mockResolvedValue(undefined);
      const db = { insert: jest.fn() } as never;
      const tx = { insert: jest.fn().mockReturnValue({ values }) } as never;
      const repo = new DrizzleTransactionEntryRepository(db);

      await repo.saveMany([makeEntry()], tx);

      expect(tx.insert).toHaveBeenCalled();
    });

    it('should map entries with null description to undefined', async () => {
      const values = jest.fn().mockResolvedValue(undefined);
      const db = { insert: jest.fn().mockReturnValue({ values }) } as never;
      const repo = new DrizzleTransactionEntryRepository(db);

      const entry = TransactionEntryEntity.reconstitute({
        id: ENTRY_ID,
        transactionId: TX_ID,
        type: TransactionEntryType.PLATFORM_FEE,
        amountInCents: 1000,
        description: null,
        createdAt: new Date(),
      });

      await repo.saveMany([entry]);

      const mappedEntry = values.mock.calls[0][0][0];
      expect(mappedEntry.description).toBeUndefined();
    });
  });

  describe('findByTransactionId', () => {
    it('should return mapped TransactionEntryEntity array', async () => {
      const row = {
        id: ENTRY_ID,
        transactionId: TX_ID,
        type: TransactionEntryType.TENANT_REVENUE as string,
        amount: 9000,
        description: 'Revenue',
        createdAt: new Date(),
      };
      const db = {
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([row]),
          }),
        }),
      } as never;
      const repo = new DrizzleTransactionEntryRepository(db);

      const result = await repo.findByTransactionId(UuidVO.fromString(TX_ID), TENANT_ID);

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(TransactionEntryEntity);
      expect(result[0].transactionId).toBe(TX_ID);
    });

    it('should return empty array when no entries found', async () => {
      const db = {
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([]),
          }),
        }),
      } as never;
      const repo = new DrizzleTransactionEntryRepository(db);

      const result = await repo.findByTransactionId(UuidVO.fromString(TX_ID), TENANT_ID);

      expect(result).toHaveLength(0);
    });

    it('should map null description to null in entity', async () => {
      const row = {
        id: ENTRY_ID,
        transactionId: TX_ID,
        type: TransactionEntryType.PLATFORM_FEE as string,
        amount: 1000,
        description: null,
        createdAt: new Date(),
      };
      const db = {
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([row]),
          }),
        }),
      } as never;
      const repo = new DrizzleTransactionEntryRepository(db);

      const result = await repo.findByTransactionId(UuidVO.fromString(TX_ID), TENANT_ID);

      expect(result[0].description).toBeNull();
    });
  });
});
