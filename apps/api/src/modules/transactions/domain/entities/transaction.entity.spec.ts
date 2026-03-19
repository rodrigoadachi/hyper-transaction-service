import { TransactionEntity } from './transaction.entity';
import { TransactionStatus } from '../value-objects/transaction-status.vo';
import { TransactionSource } from '../value-objects/transaction-source.vo';

const validParams = {
  tenantId: 'tenant-abc',
  idempotencyKey: 'key-001',
  amountInCents: 15000,
  currency: 'BRL',
  source: TransactionSource.MANUAL,
};

describe('TransactionEntity', () => {
  describe('create()', () => {
    it('should create a transaction with PENDING status', () => {
      const tx = TransactionEntity.create(validParams);
      expect(tx.status).toBe(TransactionStatus.PENDING);
    });

    it('should generate a UUIDv7 id', () => {
      const tx = TransactionEntity.create(validParams);
      expect(tx.id.toString()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should set tenantId and idempotencyKey from params', () => {
      const tx = TransactionEntity.create(validParams);
      expect(tx.tenantId).toBe('tenant-abc');
      expect(tx.idempotencyKey).toBe('key-001');
    });

    it('should set createdAt and updatedAt to the same moment', () => {
      const before = new Date();
      const tx = TransactionEntity.create(validParams);
      const after = new Date();
      expect(tx.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(tx.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(tx.createdAt.getTime()).toBe(tx.updatedAt.getTime());
    });

    it('should set processedAt to null', () => {
      const tx = TransactionEntity.create(validParams);
      expect(tx.processedAt).toBeNull();
    });

    it('should store optional externalRef', () => {
      const tx = TransactionEntity.create({ ...validParams, externalRef: 'order-abc' });
      expect(tx.externalRef).toBe('order-abc');
    });

    it('should store optional metadata', () => {
      const meta = { orderId: '123' };
      const tx = TransactionEntity.create({ ...validParams, metadata: meta });
      expect(tx.metadata).toEqual(meta);
    });

    it('should store optional description', () => {
      const tx = TransactionEntity.create({ ...validParams, description: 'Test payment' });
      expect(tx.description).toBe('Test payment');
    });

    it('should set null for missing optional fields', () => {
      const tx = TransactionEntity.create(validParams);
      expect(tx.externalRef).toBeNull();
      expect(tx.metadata).toBeNull();
      expect(tx.description).toBeNull();
    });

    it('should throw when amount is invalid', () => {
      expect(() => TransactionEntity.create({ ...validParams, amountInCents: 0 })).toThrow();
    });

    it('should throw when currency is invalid', () => {
      expect(() => TransactionEntity.create({ ...validParams, currency: 'XX' })).toThrow();
    });
  });

  describe('reconstitute()', () => {
    it('should reconstitute an entity with all provided fields', () => {
      const createdAt = new Date('2024-01-01T00:00:00Z');
      const updatedAt = new Date('2024-01-02T00:00:00Z');
      const tx = TransactionEntity.reconstitute({
        id: '01945cf0-0000-7000-8000-000000000001',
        tenantId: 'tenant-xyz',
        idempotencyKey: 'key-999',
        amountInCents: 5000,
        currency: 'USD',
        source: TransactionSource.WEBHOOK,
        description: null,
        status: TransactionStatus.COMPLETED,
        externalRef: 'ref-1',
        metadata: null,
        createdAt,
        updatedAt,
        processedAt: updatedAt,
      });

      expect(tx.id.toString()).toBe('01945cf0-0000-7000-8000-000000000001');
      expect(tx.status).toBe(TransactionStatus.COMPLETED);
      expect(tx.source).toBe(TransactionSource.WEBHOOK);
      expect(tx.processedAt).toBe(updatedAt);
    });
  });
});
