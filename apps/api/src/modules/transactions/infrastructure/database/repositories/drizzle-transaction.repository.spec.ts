import { DrizzleTransactionRepository } from './drizzle-transaction.repository';
import { TransactionSource } from '../../../domain/value-objects/transaction-source.vo';
import { TransactionStatus } from '../../../domain/value-objects/transaction-status.vo';
import { TransactionEntity } from '../../../domain/entities/transaction.entity';
import { UuidVO } from '../../../../../shared/domain/value-objects/uuid.vo';

const TX_ID = '01945cf0-0000-7000-8000-000000000001';
const TENANT_ID = 'tenant-abc';

function makeDbRow() {
  return {
    id: TX_ID,
    tenantId: TENANT_ID,
    idempotencyKey: 'key-001',
    amount: 10000,
    currency: 'BRL',
    source: TransactionSource.MANUAL as string,
    description: null,
    status: TransactionStatus.COMPLETED as string,
    externalRef: null,
    metadata: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    processedAt: null,
  };
}

function makeTransaction(): TransactionEntity {
  return TransactionEntity.reconstitute({
    id: TX_ID,
    tenantId: TENANT_ID,
    idempotencyKey: 'key-001',
    amountInCents: 10000,
    currency: 'BRL',
    source: TransactionSource.MANUAL,
    description: null,
    status: TransactionStatus.PENDING,
    externalRef: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    processedAt: null,
  });
}

describe('DrizzleTransactionRepository', () => {
  describe('save', () => {
    it('should insert transaction using db directly when no tx provided', async () => {
      const insertValues = jest.fn().mockResolvedValue(undefined);
      const db = { insert: jest.fn().mockReturnValue({ values: insertValues }) };
      const repo = new DrizzleTransactionRepository(db as never);

      await repo.save(makeTransaction());

      expect(db.insert).toHaveBeenCalled();
      expect(insertValues).toHaveBeenCalled();
    });

    it('should insert transaction using provided tx', async () => {
      const insertValues = jest.fn().mockResolvedValue(undefined);
      const db = { insert: jest.fn() };
      const tx = { insert: jest.fn().mockReturnValue({ values: insertValues }) };
      const repo = new DrizzleTransactionRepository(db as never);

      await repo.save(makeTransaction(), tx as never);

      expect(tx.insert).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return a TransactionEntity when row is found', async () => {
      const row = makeDbRow();
      const db = {
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([row]),
            }),
          }),
        }),
      };
      const repo = new DrizzleTransactionRepository(db as never);

      const result = await repo.findById(UuidVO.fromString(TX_ID), TENANT_ID);

      expect(result).toBeInstanceOf(TransactionEntity);
      expect(result).not.toBeNull();
      expect(result?.id.toString()).toBe(TX_ID);
    });

    it('should return null when no row is found', async () => {
      const db = {
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      };
      const repo = new DrizzleTransactionRepository(db as never);

      const result = await repo.findById(UuidVO.fromString(TX_ID), TENANT_ID);

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const row = makeDbRow();
      let selectCall = 0;
      const db = {
        select: jest.fn().mockImplementation(() => {
          if (selectCall++ === 0) {
            return {
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                  orderBy: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                      offset: jest.fn().mockResolvedValue([row]),
                    }),
                  }),
                }),
              }),
            };
          }
          return {
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue([{ total: 1 }]),
            }),
          };
        }),
      };
      const repo = new DrizzleTransactionRepository(db as never);

      const result = await repo.findAll(TENANT_ID, { page: 1, limit: 10, status: undefined, source: undefined });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should handle filters for status and source', async () => {
      let selectCall = 0;
      const db = {
        select: jest.fn().mockImplementation(() => {
          if (selectCall++ === 0) {
            return {
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                  orderBy: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                      offset: jest.fn().mockResolvedValue([]),
                    }),
                  }),
                }),
              }),
            };
          }
          return {
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue([{ total: 0 }]),
            }),
          };
        }),
      };
      const repo = new DrizzleTransactionRepository(db as never);

      const result = await repo.findAll(TENANT_ID, {
        page: 1,
        limit: 10,
        status: TransactionStatus.PENDING,
        source: TransactionSource.MANUAL,
      });

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });

    it('should default total to 0 when countRow is undefined', async () => {
      let selectCall = 0;
      const db = {
        select: jest.fn().mockImplementation(() => {
          if (selectCall++ === 0) {
            return {
              from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                  orderBy: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                      offset: jest.fn().mockResolvedValue([]),
                    }),
                  }),
                }),
              }),
            };
          }
          return {
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue([]),
            }),
          };
        }),
      } as never;
      const repo = new DrizzleTransactionRepository(db);

      const result = await repo.findAll(TENANT_ID, { page: 1, limit: 10, status: undefined, source: undefined });

      expect(result.meta.total).toBe(0);
    });
  });

  describe('updateStatus', () => {
    it('should update status to COMPLETED and set processedAt', async () => {
      const where = jest.fn().mockResolvedValue(undefined);
      const db = {
        update: jest.fn().mockReturnValue({
          set: jest.fn().mockReturnValue({ where }),
        }),
      } as never;
      const repo = new DrizzleTransactionRepository(db);

      await repo.updateStatus(UuidVO.fromString(TX_ID), TENANT_ID, TransactionStatus.COMPLETED);

      expect(where).toHaveBeenCalled();
    });

    it('should update status to FAILED without setting processedAt', async () => {
      const setMock = jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) });
      const db = {
        update: jest.fn().mockReturnValue({ set: setMock }),
      } as never;
      const repo = new DrizzleTransactionRepository(db);

      await repo.updateStatus(UuidVO.fromString(TX_ID), TENANT_ID, TransactionStatus.FAILED);

      const setArgs = setMock.mock.calls[0][0];
      expect(setArgs.processedAt).toBeUndefined();
    });

    it('should use tx when provided', async () => {
      const where = jest.fn().mockResolvedValue(undefined);
      const db = { update: jest.fn() };
      const tx = {
        update: jest.fn().mockReturnValue({
          set: jest.fn().mockReturnValue({ where }),
        }),
      };
      const repo = new DrizzleTransactionRepository(db as never);

      await repo.updateStatus(UuidVO.fromString(TX_ID), TENANT_ID, TransactionStatus.FAILED, tx as never);

      expect(tx.update).toHaveBeenCalled();
    });
  });

  describe('withTransaction', () => {
    it('should execute work inside a db transaction', async () => {
      const work = jest.fn().mockResolvedValue('result');
      const db = {
        transaction: jest.fn().mockImplementation((fn: (tx: unknown) => unknown) => fn({})),
      };
      const repo = new DrizzleTransactionRepository(db as never);

      const result = await repo.withTransaction(work);

      expect(result).toBe('result');
      expect(work).toHaveBeenCalledTimes(1);
    });
  });
});
