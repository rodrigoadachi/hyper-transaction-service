import { ListTransactionsUseCase } from './list-transactions.use-case';
import { TransactionEntity } from '../../domain/entities/transaction.entity';
import { TransactionSource } from '../../domain/value-objects/transaction-source.vo';
import { TransactionStatus } from '../../domain/value-objects/transaction-status.vo';
import type { ITransactionRepository, PaginatedResult } from '../ports/transaction-repository.port';
import type { ITransactionCacheService } from '../ports/transaction-cache.port';

const TENANT_ID = 'tenant-abc';

const makeTransactionRepository = (): jest.Mocked<ITransactionRepository> => ({
  save: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  updateStatus: jest.fn(),
  withTransaction: jest.fn(),
});

const makeCacheService = (): jest.Mocked<ITransactionCacheService> => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  invalidatePattern: jest.fn().mockResolvedValue(undefined),
});

const makeTransaction = (overrides: Partial<Parameters<typeof TransactionEntity.reconstitute>[0]> = {}) =>
  TransactionEntity.reconstitute({
    id: '01945cf0-0000-7000-8000-000000000001',
    tenantId: TENANT_ID,
    idempotencyKey: 'key-001',
    amountInCents: 15000,
    currency: 'BRL',
    source: TransactionSource.MANUAL,
    description: null,
    status: TransactionStatus.PENDING,
    externalRef: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    processedAt: null,
    ...overrides,
  });

const makePaginatedResult = (items: TransactionEntity[]): PaginatedResult<TransactionEntity> => ({
  data: items,
  meta: { total: items.length, page: 1, limit: 20, totalPages: 1 },
});

describe('ListTransactionsUseCase', () => {
  let useCase: ListTransactionsUseCase;
  let transactionRepository: jest.Mocked<ITransactionRepository>;
  let cacheService: jest.Mocked<ITransactionCacheService>;

  beforeEach(() => {
    transactionRepository = makeTransactionRepository();
    cacheService = makeCacheService();
    useCase = new ListTransactionsUseCase(
      transactionRepository as ITransactionRepository,
      cacheService as ITransactionCacheService,
    );
  });

  it('should return paginated transactions for the tenant', async () => {
    const tx = makeTransaction();
    transactionRepository.findAll.mockResolvedValue(makePaginatedResult([tx]));

    const result = await useCase.execute({ tenantId: TENANT_ID, page: 1, limit: 20 });

    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
    expect(transactionRepository.findAll).toHaveBeenCalledWith(TENANT_ID, {
      page: 1,
      limit: 20,
      status: undefined,
      source: undefined,
    });
  });

  it('should pass status and source filters to the repository', async () => {
    transactionRepository.findAll.mockResolvedValue(makePaginatedResult([]));

    await useCase.execute({
      tenantId: TENANT_ID,
      page: 1,
      limit: 10,
      status: TransactionStatus.COMPLETED,
      source: TransactionSource.WEBHOOK,
    });

    expect(transactionRepository.findAll).toHaveBeenCalledWith(TENANT_ID, {
      page: 1,
      limit: 10,
      status: TransactionStatus.COMPLETED,
      source: TransactionSource.WEBHOOK,
    });
  });

  it('should return empty list when no transactions exist', async () => {
    transactionRepository.findAll.mockResolvedValue(makePaginatedResult([]));

    const result = await useCase.execute({ tenantId: TENANT_ID, page: 1, limit: 20 });

    expect(result.data).toHaveLength(0);
    expect(result.meta.total).toBe(0);
  });
});
