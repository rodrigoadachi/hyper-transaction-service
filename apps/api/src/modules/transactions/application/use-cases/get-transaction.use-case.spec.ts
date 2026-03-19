import { GetTransactionUseCase } from './get-transaction.use-case';
import { NotFoundError } from '../../../../shared/domain/errors';
import { TransactionEntity } from '../../domain/entities/transaction.entity';
import { TransactionSource } from '../../domain/value-objects/transaction-source.vo';
import { TransactionStatus } from '../../domain/value-objects/transaction-status.vo';
import type { ITransactionRepository } from '../ports/transaction-repository.port';
import type { ITransactionEntryRepository } from '../ports/transaction-entry-repository.port';

const TENANT_ID = 'tenant-abc';
const VALID_ID = '01945cf0-0000-7000-8000-000000000001';

const makeTransactionRepository = (): jest.Mocked<ITransactionRepository> => ({
  save: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  updateStatus: jest.fn(),
  withTransaction: jest.fn(),
});

const makeEntryRepository = (): jest.Mocked<ITransactionEntryRepository> => ({
  saveMany: jest.fn(),
  findByTransactionId: jest.fn(),
});

const makeTransaction = () =>
  TransactionEntity.reconstitute({
    id: VALID_ID,
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
  });

describe('GetTransactionUseCase', () => {
  let useCase: GetTransactionUseCase;
  let transactionRepository: jest.Mocked<ITransactionRepository>;
  let entryRepository: jest.Mocked<ITransactionEntryRepository>;

  beforeEach(() => {
    transactionRepository = makeTransactionRepository();
    entryRepository = makeEntryRepository();
    useCase = new GetTransactionUseCase(
      transactionRepository as ITransactionRepository,
      entryRepository as ITransactionEntryRepository,
    );
  });

  it('should return a transaction with its entries when found', async () => {
    const tx = makeTransaction();
    transactionRepository.findById.mockResolvedValue(tx);
    entryRepository.findByTransactionId.mockResolvedValue([]);

    const result = await useCase.execute({ id: VALID_ID, tenantId: TENANT_ID });

    expect(result.transaction.id.toString()).toBe(VALID_ID);
    expect(result.entries).toEqual([]);
    expect(transactionRepository.findById).toHaveBeenCalledTimes(1);
    expect(entryRepository.findByTransactionId).toHaveBeenCalledTimes(1);
  });

  it('should throw NotFoundError when transaction does not exist', async () => {
    transactionRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute({ id: VALID_ID, tenantId: TENANT_ID })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('should throw NotFoundError for an invalid UUID format', async () => {
    await expect(useCase.execute({ id: 'not-a-uuid', tenantId: TENANT_ID })).rejects.toBeInstanceOf(NotFoundError);
    expect(transactionRepository.findById).not.toHaveBeenCalled();
  });

  it('should pass tenantId to repository to enforce isolation', async () => {
    transactionRepository.findById.mockResolvedValue(makeTransaction());
    entryRepository.findByTransactionId.mockResolvedValue([]);

    await useCase.execute({ id: VALID_ID, tenantId: 'tenant-xyz' });

    const [, calledTenantId] = transactionRepository.findById.mock.calls[0];
    expect(calledTenantId).toBe('tenant-xyz');
  });
});
