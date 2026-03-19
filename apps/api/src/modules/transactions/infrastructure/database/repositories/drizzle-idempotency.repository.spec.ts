import { DrizzleIdempotencyRepository } from './drizzle-idempotency.repository';

const TENANT_ID = 'tenant-abc';
const KEY = 'idempotency-key-001';
const RESULT_ID = '01945cf0-0000-7000-8000-000000000001';

describe('DrizzleIdempotencyRepository', () => {
  describe('tryAcquire', () => {
    it('should return acquired=true when insert succeeds (new key)', async () => {
      const db = {
        insert: jest.fn().mockReturnValue({
          values: jest.fn().mockReturnValue({
            onConflictDoNothing: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([{ id: 'new-id' }]),
            }),
          }),
        }),
      };
      const repo = new DrizzleIdempotencyRepository(db as never);

      const result = await repo.tryAcquire(TENANT_ID, KEY, new Date());

      expect(result.acquired).toBe(true);
      expect(result.resultId).toBeNull();
      expect(result.status).toBe('PROCESSING');
    });

    it('should return acquired=false with resultId when key exists and status is COMPLETED', async () => {
      const db = {
        insert: jest.fn().mockReturnValue({
          values: jest.fn().mockReturnValue({
            onConflictDoNothing: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          set: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([{ resultId: RESULT_ID, status: 'COMPLETED' }]),
            }),
          }),
        }),
      } as never;
      const repo = new DrizzleIdempotencyRepository(db);

      const result = await repo.tryAcquire(TENANT_ID, KEY, new Date());

      expect(result.acquired).toBe(false);
      expect(result.resultId).toBe(RESULT_ID);
      expect(result.status).toBe('COMPLETED');
    });

    it('should return acquired=false with null resultId when key exists and status is PROCESSING', async () => {
      const db = {
        insert: jest.fn().mockReturnValue({
          values: jest.fn().mockReturnValue({
            onConflictDoNothing: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          set: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([{ resultId: null, status: 'PROCESSING' }]),
            }),
          }),
        }),
      } as never;
      const repo = new DrizzleIdempotencyRepository(db);

      const result = await repo.tryAcquire(TENANT_ID, KEY, new Date());

      expect(result.acquired).toBe(false);
      expect(result.resultId).toBeNull();
      expect(result.status).toBe('PROCESSING');
    });

    it('should reset FAILED key back to PROCESSING with conditional update and return acquired=true', async () => {
      const updateReturning = jest.fn().mockResolvedValue([{ id: 'reclaimed-id' }]);
      const db = {
        insert: jest.fn().mockReturnValue({
          values: jest.fn().mockReturnValue({
            onConflictDoNothing: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          set: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({ returning: updateReturning }),
          }),
        }),
      } as never;
      const repo = new DrizzleIdempotencyRepository(db);

      const result = await repo.tryAcquire(TENANT_ID, KEY, new Date());

      expect(result.acquired).toBe(true);
      expect(result.status).toBe('PROCESSING');
      expect(updateReturning).toHaveBeenCalled();
    });

    it('should handle undefined existing when no row found', async () => {
      const db = {
        insert: jest.fn().mockReturnValue({
          values: jest.fn().mockReturnValue({
            onConflictDoNothing: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          set: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as never;
      const repo = new DrizzleIdempotencyRepository(db);

      const result = await repo.tryAcquire(TENANT_ID, KEY, new Date());

      expect(result.acquired).toBe(false);
      expect(result.resultId).toBeNull();
      expect(result.status).toBeNull();
    });
  });

  describe('getStatus', () => {
    it('should return the current status when the key exists', async () => {
      const db = {
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([{ resultId: RESULT_ID, status: 'COMPLETED' }]),
            }),
          }),
        }),
      } as never;
      const repo = new DrizzleIdempotencyRepository(db);

      const result = await repo.getStatus(TENANT_ID, KEY);

      expect(result).toEqual({ resultId: RESULT_ID, status: 'COMPLETED' });
    });
  });

  describe('complete', () => {
    it('should update status to COMPLETED with resultId using db directly', async () => {
      const where = jest.fn().mockResolvedValue(undefined);
      const db = {
        update: jest.fn().mockReturnValue({
          set: jest.fn().mockReturnValue({ where }),
        }),
      } as never;
      const repo = new DrizzleIdempotencyRepository(db);

      await repo.complete(TENANT_ID, KEY, RESULT_ID);

      expect(where).toHaveBeenCalled();
    });

    it('should update using provided tx', async () => {
      const where = jest.fn().mockResolvedValue(undefined);
      const db = { update: jest.fn() };
      const tx = {
        update: jest.fn().mockReturnValue({
          set: jest.fn().mockReturnValue({ where }),
        }),
      };
      const repo = new DrizzleIdempotencyRepository(db as never);

      await repo.complete(TENANT_ID, KEY, RESULT_ID, tx as never);

      expect(tx.update).toHaveBeenCalled();
    });
  });

  describe('fail', () => {
    it('should update status to FAILED', async () => {
      const where = jest.fn().mockResolvedValue(undefined);
      const db = {
        update: jest.fn().mockReturnValue({
          set: jest.fn().mockReturnValue({ where }),
        }),
      } as never;
      const repo = new DrizzleIdempotencyRepository(db);

      await repo.fail(TENANT_ID, KEY);

      expect(where).toHaveBeenCalled();
    });
  });
});
