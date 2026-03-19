import { UnprocessableEntityException } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionSource } from '../../domain/value-objects/transaction-source.vo';
import { TransactionStatus } from '../../domain/value-objects/transaction-status.vo';
import { TransactionEntity } from '../../domain/entities/transaction.entity';
import { TransactionEntryEntity } from '../../domain/entities/transaction-entry.entity';
import { TransactionEntryType } from '../../domain/value-objects/transaction-entry-type.vo';
import type { CreateTransactionUseCase } from '../../application/use-cases/create-transaction.use-case';
import type { ListTransactionsUseCase } from '../../application/use-cases/list-transactions.use-case';
import type { GetTransactionUseCase } from '../../application/use-cases/get-transaction.use-case';

const TX_ID = '01945cf0-0000-7000-8000-000000000001';
const TENANT_ID = 'tenant-abc';

function makeTransaction(): TransactionEntity {
  return TransactionEntity.reconstitute({
    id: TX_ID,
    tenantId: TENANT_ID,
    idempotencyKey: 'key-001',
    amountInCents: 10000,
    currency: 'BRL',
    source: TransactionSource.MANUAL,
    description: null,
    status: TransactionStatus.COMPLETED,
    externalRef: null,
    metadata: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    processedAt: null,
  });
}

function makeEntry(): TransactionEntryEntity {
  return TransactionEntryEntity.reconstitute({
    id: '01945cf0-0000-7000-8000-000000000002',
    tenantId: TENANT_ID,
    transactionId: TX_ID,
    type: TransactionEntryType.TENANT_REVENUE,
    amountInCents: 9000,
    description: 'Tenant revenue (90%)',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

const makeCreateUseCase = (): jest.Mocked<CreateTransactionUseCase> =>
  ({ execute: jest.fn() }) as unknown as jest.Mocked<CreateTransactionUseCase>;

const makeListUseCase = (): jest.Mocked<ListTransactionsUseCase> =>
  ({ execute: jest.fn() }) as unknown as jest.Mocked<ListTransactionsUseCase>;

const makeGetUseCase = (): jest.Mocked<GetTransactionUseCase> =>
  ({ execute: jest.fn() }) as unknown as jest.Mocked<GetTransactionUseCase>;

function makeReq(tenantId = TENANT_ID) {
  return { user: { sub: tenantId, email: 'user@example.com' } } as never;
}

function makeRes() {
  const res = { status: jest.fn() };
  res.status.mockReturnValue(res);
  return res as never;
}

describe('TransactionsController', () => {
  let controller: TransactionsController;
  let createUseCase: jest.Mocked<CreateTransactionUseCase>;
  let listUseCase: jest.Mocked<ListTransactionsUseCase>;
  let getUseCase: jest.Mocked<GetTransactionUseCase>;

  beforeEach(() => {
    createUseCase = makeCreateUseCase();
    listUseCase = makeListUseCase();
    getUseCase = makeGetUseCase();
    controller = new TransactionsController(createUseCase, listUseCase, getUseCase);
  });

  describe('create', () => {
    const dto = {
      amountInCents: 10000,
      currency: 'BRL',
      source: 'MANUAL',
      description: undefined,
      externalRef: undefined,
      metadata: undefined,
    };

    it('should return HTTP 201 and data for new transaction', async () => {
      const tx = makeTransaction();
      createUseCase.execute.mockResolvedValue({ transaction: tx, idempotent: false });
      const res = makeRes();

      const result = await controller.create(makeReq(), res, 'key-001', dto as never);

      expect(result.data).toBeDefined();
      expect(result.cached).toBeUndefined();
    });

    it('should return HTTP 200 and cached:true for idempotent transaction', async () => {
      const tx = makeTransaction();
      createUseCase.execute.mockResolvedValue({ transaction: tx, idempotent: true });
      const res = makeRes();

      const result = await controller.create(makeReq(), res, 'key-001', dto as never);

      expect(result.cached).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should throw UnprocessableEntityException when idempotency key is missing', async () => {
      const res = makeRes();

      await expect(
        controller.create(makeReq(), res, undefined, dto as never),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('should throw UnprocessableEntityException when idempotency key is empty', async () => {
      const res = makeRes();

      await expect(
        controller.create(makeReq(), res, '   ', dto as never),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('should throw UnprocessableEntityException when idempotency key exceeds 255 chars', async () => {
      const res = makeRes();
      const longKey = 'a'.repeat(256);

      await expect(
        controller.create(makeReq(), res, longKey, dto as never),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  describe('list', () => {
    it('should return data and meta for transaction list', async () => {
      const tx = makeTransaction();
      listUseCase.execute.mockResolvedValue({
        data: [tx],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });

      const query = { page: 1, limit: 20 } as never;
      const result = await controller.list(makeReq(), query);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should return empty data when no transactions exist', async () => {
      listUseCase.execute.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      });

      const query = { page: 1, limit: 20 } as never;
      const result = await controller.list(makeReq(), query);

      expect(result.data).toHaveLength(0);
    });
  });

  describe('getById', () => {
    it('should return transaction data with entries', async () => {
      const tx = makeTransaction();
      const entry = makeEntry();
      getUseCase.execute.mockResolvedValue({ transaction: tx, entries: [entry] });

      const result = await controller.getById(makeReq(), TX_ID);

      expect(result.data.id).toBe(TX_ID);
      expect(result.data.entries).toHaveLength(1);
    });

    it('should include processedAt ISO string when transaction has processedAt', async () => {
      const tx = TransactionEntity.reconstitute({
        id: TX_ID,
        tenantId: TENANT_ID,
        idempotencyKey: 'key-001',
        amountInCents: 10000,
        currency: 'BRL',
        source: TransactionSource.MANUAL,
        description: 'test',
        status: TransactionStatus.COMPLETED,
        externalRef: 'ref-001',
        metadata: { extra: true },
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        processedAt: new Date('2026-01-02T00:00:00.000Z'),
      });
      getUseCase.execute.mockResolvedValue({ transaction: tx, entries: [] });

      const result = await controller.getById(makeReq(), TX_ID);

      expect(result.data.processedAt).toBe('2026-01-02T00:00:00.000Z');
    });
  });
});
