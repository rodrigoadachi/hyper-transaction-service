import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, lt } from 'drizzle-orm';
import { DRIZZLE_TOKEN, type DrizzleDb } from '../../../../../shared/infrastructure/database/drizzle.provider';
import { idempotencyKeysTable } from '../../../../../shared/infrastructure/database/schema';
import { UuidVO } from '../../../../../shared/domain/value-objects/uuid.vo';
import type {
  IIdempotencyRepository,
  IdempotencyAcquireResult,
  IdempotencyStatusResult,
} from '../../../application/ports/idempotency-repository.port';

@Injectable()
export class DrizzleIdempotencyRepository implements IIdempotencyRepository {
  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb) { }

  async tryAcquire(
    tenantId: string,
    key: string,
    expiresAt: Date,
    tx?: unknown,
  ): Promise<IdempotencyAcquireResult> {
    const db = (tx as DrizzleDb | undefined) ?? this.db;
    const id = UuidVO.generate().toString();

    const inserted = await db
      .insert(idempotencyKeysTable)
      .values({ id, tenantId, key, status: 'PROCESSING', expiresAt })
      .onConflictDoNothing()
      .returning({ id: idempotencyKeysTable.id });

    if (inserted.length > 0) {
      return { acquired: true, resultId: null, status: 'PROCESSING' };
    }

    const reclaimed = await db
      .update(idempotencyKeysTable)
      .set({ status: 'PROCESSING', resultId: null, expiresAt })
      .where(
        and(
          eq(idempotencyKeysTable.tenantId, tenantId),
          eq(idempotencyKeysTable.key, key),
          eq(idempotencyKeysTable.status, 'FAILED'),
        ),
      )
      .returning({ id: idempotencyKeysTable.id });

    if (reclaimed.length > 0) {
      return { acquired: true, resultId: null, status: 'PROCESSING' };
    }

    const existing = await this.getStatus(tenantId, key);

    return {
      acquired: false,
      resultId: existing?.resultId ?? null,
      status: existing?.status ?? null,
    };
  }

  async getStatus(tenantId: string, key: string): Promise<IdempotencyStatusResult | null> {
    const [existing] = await this.db
      .select({ resultId: idempotencyKeysTable.resultId, status: idempotencyKeysTable.status })
      .from(idempotencyKeysTable)
      .where(
        and(
          eq(idempotencyKeysTable.tenantId, tenantId),
          eq(idempotencyKeysTable.key, key),
        ),
      )
      .limit(1);

    if (!existing) return null;

    return {
      resultId: existing.resultId,
      status: existing.status as IdempotencyStatusResult['status'],
    };
  }

  async complete(tenantId: string, key: string, resultId: string, tx?: unknown): Promise<void> {
    const db = (tx as DrizzleDb | undefined) ?? this.db;
    await db
      .update(idempotencyKeysTable)
      .set({ resultId, status: 'COMPLETED' })
      .where(
        and(
          eq(idempotencyKeysTable.tenantId, tenantId),
          eq(idempotencyKeysTable.key, key),
        ),
      );
  }

  async fail(tenantId: string, key: string, tx?: unknown): Promise<void> {
    const db = (tx as DrizzleDb | undefined) ?? this.db;
    await db
      .update(idempotencyKeysTable)
      .set({ status: 'FAILED' })
      .where(
        and(
          eq(idempotencyKeysTable.tenantId, tenantId),
          eq(idempotencyKeysTable.key, key),
          eq(idempotencyKeysTable.status, 'PROCESSING'),
        ),
      );
  }

  async deleteExpired(batchSize = 500): Promise<number> {
    const expiredIds = await this.db
      .select({ id: idempotencyKeysTable.id })
      .from(idempotencyKeysTable)
      .where(lt(idempotencyKeysTable.expiresAt, new Date()))
      .limit(batchSize);

    if (expiredIds.length === 0) return 0;

    const ids = expiredIds.map((r) => r.id);
    const deleted = await this.db
      .delete(idempotencyKeysTable)
      .where(inArray(idempotencyKeysTable.id, ids))
      .returning({ id: idempotencyKeysTable.id });

    return deleted.length;
  }
}
