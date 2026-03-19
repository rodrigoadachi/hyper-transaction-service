import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE_TOKEN, type DrizzleDb } from '../../../../../shared/infrastructure/database/drizzle.provider';
import { transactionEntriesTable } from '../../../../../shared/infrastructure/database/schema';
import { TransactionEntryEntity } from '../../../domain/entities/transaction-entry.entity';
import type { TransactionEntryType } from '../../../domain/value-objects/transaction-entry-type.vo';
import type { ITransactionEntryRepository } from '../../../application/ports/transaction-entry-repository.port';
import type { UuidVO } from '../../../../../shared/domain/value-objects/uuid.vo';

type TransactionEntryRow = typeof transactionEntriesTable.$inferSelect;

@Injectable()
export class DrizzleTransactionEntryRepository implements ITransactionEntryRepository {
  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb) {}

  async saveMany(entries: TransactionEntryEntity[], tx?: unknown): Promise<void> {
    if (entries.length === 0) return;

    const db = (tx as DrizzleDb | undefined) ?? this.db;
    await db.insert(transactionEntriesTable).values(
      entries.map((entry) => ({
        id: entry.id.toString(),
        tenantId: entry.tenantId,
        transactionId: entry.transactionId,
        type: entry.type,
        amount: entry.amountInCents,
        description: entry.description ?? undefined,
        createdAt: entry.createdAt,
      })),
    );
  }

  async findByTransactionId(transactionId: UuidVO, _tenantId: string): Promise<TransactionEntryEntity[]> {
    const rows = await this.db
      .select()
      .from(transactionEntriesTable)
      .where(
        and(
          eq(transactionEntriesTable.transactionId, transactionId.toString()),
          eq(transactionEntriesTable.tenantId, _tenantId),
        ),
      );

    return rows.map((row) => this.toEntity(row));
  }

  private toEntity(row: TransactionEntryRow): TransactionEntryEntity {
    return TransactionEntryEntity.reconstitute({
      id: row.id,
      tenantId: row.tenantId,
      transactionId: row.transactionId,
      type: row.type as TransactionEntryType,
      amountInCents: row.amount,
      description: row.description ?? null,
      createdAt: row.createdAt,
    });
  }
}
