import { CreateTransactionUseCase } from './create-transaction.use-case';
import { IdempotencyConflictError, NotFoundError } from '../../../../shared/domain/errors';
import { TransactionEntity } from '../../domain/entities/transaction.entity';
import { TransactionSource } from '../../domain/value-objects/transaction-source.vo';
import { TransactionStatus } from '../../domain/value-objects/transaction-status.vo';
import { TransactionEntryType } from '../../domain/value-objects/transaction-entry-type.vo';
import { UuidVO } from '../../../../shared/domain/value-objects/uuid.vo';
import type { ITransactionRepository } from '../ports/transaction-repository.port';
import type { IIdempotencyRepository } from '../ports/idempotency-repository.port';
import type { ITransactionEntryRepository } from '../ports/transaction-entry-repository.port';
import type { ITransactionEventPublisher } from '../ports/transaction-event-publisher.port';
import type { ITransactionCacheService } from '../ports/transaction-cache.port';

const TENANT_ID = 'tenant-abc';
const IDEMPOTENCY_KEY = 'key-001';

const validInput = {
  tenantId: TENANT_ID,
  idempotencyKey: IDEMPOTENCY_KEY,
  amountInCents: 15000,
  currency: 'BRL',
  source: TransactionSource.MANUAL,
};

const makeTransactionRepository = (): jest.Mocked<ITransactionRepository> => ({
  save: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  updateStatus: jest.fn(),
  withTransaction: jest.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(undefined)),
});

const makeIdempotencyRepository = (): jest.Mocked<IIdempotencyRepository> => ({
  tryAcquire: jest.fn(),
  getStatus: jest.fn(),
  complete: jest.fn(),
  fail: jest.fn(),
  deleteExpired: jest.fn(),
});

const makeEventPublisher = (): jest.Mocked<ITransactionEventPublisher> => ({
  publishTransactionCompleted: jest.fn().mockResolvedValue(undefined),
});

const makeCacheService = (): jest.Mocked<ITransactionCacheService> => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  invalidatePattern: jest.fn().mockResolvedValue(undefined),
});

const makeEntryRepository = (): jest.Mocked<ITransactionEntryRepository> => ({
  saveMany: jest.fn(),
  findByTransactionId: jest.fn(),
});

const makeStoredTransaction = () =>
  TransactionEntity.reconstitute({
    id: '01945cf0-0000-7000-8000-000000000001',
    tenantId: TENANT_ID,
    idempotencyKey: IDEMPOTENCY_KEY,
    amountInCents: 15000,
    currency: 'BRL',
    source: TransactionSource.MANUAL,
    description: null,
    status: TransactionStatus.COMPLETED,
    externalRef: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    processedAt: null,
  });

describe('CreateTransactionUseCase', () => {
  let useCase: CreateTransactionUseCase;
  let transactionRepository: jest.Mocked<ITransactionRepository>;
  let idempotencyRepository: jest.Mocked<IIdempotencyRepository>;
  let entryRepository: jest.Mocked<ITransactionEntryRepository>;
  let eventPublisher: jest.Mocked<ITransactionEventPublisher>;
  let cacheService: jest.Mocked<ITransactionCacheService>;

  beforeEach(() => {
    transactionRepository = makeTransactionRepository();
    idempotencyRepository = makeIdempotencyRepository();
    entryRepository = makeEntryRepository();
    eventPublisher = makeEventPublisher();
    cacheService = makeCacheService();
    useCase = new CreateTransactionUseCase(
      transactionRepository as ITransactionRepository,
      idempotencyRepository as IIdempotencyRepository,
      entryRepository as ITransactionEntryRepository,
      eventPublisher as ITransactionEventPublisher,
      cacheService as ITransactionCacheService,
    );
  });

  it('should create a transaction and split into two entries', async () => {
    idempotencyRepository.tryAcquire.mockResolvedValue({ acquired: true, resultId: null, status: 'PROCESSING' });
    idempotencyRepository.getStatus.mockResolvedValue(null);
    transactionRepository.save.mockResolvedValue();
    entryRepository.saveMany.mockResolvedValue();
    transactionRepository.updateStatus.mockResolvedValue();
    idempotencyRepository.complete.mockResolvedValue();

    const { transaction, idempotent } = await useCase.execute(validInput);

    expect(idempotent).toBe(false);
    expect(transactionRepository.save).toHaveBeenCalledTimes(1);

    const [entries] = entryRepository.saveMany.mock.calls[0];
    expect(entries).toHaveLength(2);

    const revenue = entries.find((e) => e.type === TransactionEntryType.TENANT_REVENUE);
    const fee = entries.find((e) => e.type === TransactionEntryType.PLATFORM_FEE);

    expect(revenue?.amountInCents).toBe(13500); // 90% of 15000
    expect(fee?.amountInCents).toBe(1500);      // 10% of 15000

    expect(transactionRepository.updateStatus).toHaveBeenCalledWith(
      transaction.id,
      TENANT_ID,
      TransactionStatus.COMPLETED,
      undefined, // tx passed from withTransaction mock
    );
    expect(idempotencyRepository.complete).toHaveBeenCalledWith(
      TENANT_ID,
      IDEMPOTENCY_KEY,
      transaction.id.toString(),
      undefined, // tx passed from withTransaction mock
    );
  });

  it('should mark transaction as FAILED when saveMany throws', async () => {
    idempotencyRepository.tryAcquire.mockResolvedValue({ acquired: true, resultId: null, status: 'PROCESSING' });
    idempotencyRepository.getStatus.mockResolvedValue(null);
    transactionRepository.save.mockResolvedValue();
    entryRepository.saveMany.mockRejectedValue(new Error('DB error'));
    transactionRepository.updateStatus.mockResolvedValue();
    idempotencyRepository.fail.mockResolvedValue();

    await expect(useCase.execute(validInput)).rejects.toThrow('DB error');

    expect(transactionRepository.updateStatus).toHaveBeenCalledWith(
      expect.any(UuidVO),
      TENANT_ID,
      TransactionStatus.FAILED,
    );
    expect(idempotencyRepository.complete).not.toHaveBeenCalled();
  });

  it('should call fail() on idempotency key when processing throws', async () => {
    idempotencyRepository.tryAcquire.mockResolvedValue({ acquired: true, resultId: null, status: 'PROCESSING' });
    idempotencyRepository.getStatus.mockResolvedValue(null);
    transactionRepository.save.mockResolvedValue();
    entryRepository.saveMany.mockRejectedValue(new Error('DB error'));
    transactionRepository.updateStatus.mockResolvedValue();
    idempotencyRepository.fail.mockResolvedValue();

    await expect(useCase.execute(validInput)).rejects.toThrow('DB error');

    expect(idempotencyRepository.fail).toHaveBeenCalledWith(TENANT_ID, IDEMPOTENCY_KEY);
  });

  it('should process normally on retry after a failed idempotency key', async () => {
    // Simulates: repository reset the FAILED key to PROCESSING and returned acquired=true
    idempotencyRepository.tryAcquire
      .mockResolvedValueOnce({ acquired: true, resultId: null, status: 'PROCESSING' })
      .mockResolvedValueOnce({ acquired: true, resultId: null, status: 'PROCESSING' });
    idempotencyRepository.getStatus.mockResolvedValue(null);
    transactionRepository.save.mockResolvedValue();
    entryRepository.saveMany
      .mockRejectedValueOnce(new Error('DB error')) // first attempt fails
      .mockResolvedValue();                          // retry succeeds
    transactionRepository.updateStatus.mockResolvedValue();
    idempotencyRepository.fail.mockResolvedValue();
    idempotencyRepository.complete.mockResolvedValue();

    // First attempt — fails
    await expect(useCase.execute(validInput)).rejects.toThrow('DB error');
    expect(idempotencyRepository.fail).toHaveBeenCalledWith(TENANT_ID, IDEMPOTENCY_KEY);

    // Retry — succeeds (tryAcquire returned acquired=true because key was FAILED)
    const { idempotent } = await useCase.execute(validInput);
    expect(idempotent).toBe(false);
    expect(transactionRepository.save).toHaveBeenCalledTimes(2);
  });

  it('should return cached transaction when key was already completed', async () => {
    const stored = makeStoredTransaction();
    idempotencyRepository.tryAcquire.mockResolvedValue({
      acquired: false,
      resultId: '01945cf0-0000-7000-8000-000000000001',
      status: 'COMPLETED',
    });
    transactionRepository.findById.mockResolvedValue(stored);

    const { transaction, idempotent } = await useCase.execute(validInput);

    expect(idempotent).toBe(true);
    expect(transaction.id.toString()).toBe('01945cf0-0000-7000-8000-000000000001');
    expect(transactionRepository.save).not.toHaveBeenCalled();
  });

  it('should throw IdempotencyConflictError when key is still processing', async () => {
    idempotencyRepository.tryAcquire.mockResolvedValue({ acquired: false, resultId: null, status: 'PROCESSING' });
    idempotencyRepository.getStatus.mockResolvedValue({ resultId: null, status: 'PROCESSING' });

    await expect(useCase.execute(validInput)).rejects.toBeInstanceOf(IdempotencyConflictError);
  });

  it('should wait for an in-flight request to complete and return the cached transaction', async () => {
    const stored = makeStoredTransaction();
    idempotencyRepository.tryAcquire.mockResolvedValue({ acquired: false, resultId: null, status: 'PROCESSING' });
    idempotencyRepository.getStatus
      .mockResolvedValueOnce({ resultId: null, status: 'PROCESSING' })
      .mockResolvedValueOnce({ resultId: stored.id.toString(), status: 'COMPLETED' });
    transactionRepository.findById.mockResolvedValue(stored);

    const result = await useCase.execute(validInput);

    expect(result.idempotent).toBe(true);
    expect(result.transaction.id.toString()).toBe(stored.id.toString());
  });

  it('should throw NotFoundError when cached transaction is missing from DB', async () => {
    idempotencyRepository.tryAcquire.mockResolvedValue({
      acquired: false,
      resultId: '01945cf0-0000-7000-8000-000000000001',
      status: 'COMPLETED',
    });
    transactionRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(validInput)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('should throw when transaction source is invalid', async () => {
    idempotencyRepository.tryAcquire.mockResolvedValue({ acquired: true, resultId: null, status: 'PROCESSING' });

    await expect(useCase.execute({ ...validInput, source: 'TRANSFER' as TransactionSource })).rejects.toThrow();
  });

  it('should set tenantId from input on the created entity', async () => {
    idempotencyRepository.tryAcquire.mockResolvedValue({ acquired: true, resultId: null, status: 'PROCESSING' });
    idempotencyRepository.getStatus.mockResolvedValue(null);
    transactionRepository.save.mockResolvedValue();
    entryRepository.saveMany.mockResolvedValue();
    transactionRepository.updateStatus.mockResolvedValue();
    idempotencyRepository.complete.mockResolvedValue();

    const { transaction } = await useCase.execute({ ...validInput, tenantId: 'tenant-xyz' });

    expect(transaction.tenantId).toBe('tenant-xyz');
  });
});
