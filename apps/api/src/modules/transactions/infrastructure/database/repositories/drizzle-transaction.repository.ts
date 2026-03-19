import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { DRIZZLE_TOKEN, type DrizzleDb } from '../../../../../shared/infrastructure/database/drizzle.provider';
import { transactionsTable } from '../../../../../shared/infrastructure/database/schema';
import { TransactionEntity } from '../../../domain/entities/transaction.entity';
import type { TransactionSource } from '../../../domain/value-objects/transaction-source.vo';
import { TransactionStatus } from '../../../domain/value-objects/transaction-status.vo';
import type {
  ITransactionRepository,
  ListTransactionsFilter,
  PaginatedResult,
} from '../../../application/ports/transaction-repository.port';
import type { UuidVO } from '../../../../../shared/domain/value-objects/uuid.vo';

type TransactionRow = typeof transactionsTable.$inferSelect;

@Injectable()
export class DrizzleTransactionRepository implements ITransactionRepository {
  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb) {}

  async save(transaction: TransactionEntity, tx?: unknown): Promise<void> {
    const db = (tx as DrizzleDb | undefined) ?? this.db;
    await db.insert(transactionsTable).values({
      id: transaction.id.toString(),
      tenantId: transaction.tenantId,
      idempotencyKey: transaction.idempotencyKey,
      amount: transaction.amountInCents,
      currency: transaction.currency,
      source: transaction.source,
      description: transaction.description ?? undefined,
      status: transaction.status,
      externalRef: transaction.externalRef ?? undefined,
      metadata: transaction.metadata ?? undefined,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      processedAt: transaction.processedAt ?? undefined,
    });
  }

  async findById(id: UuidVO, tenantId: string): Promise<TransactionEntity | null> {
    const [row] = await this.db
      .select()
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.id, id.toString()),
          eq(transactionsTable.tenantId, tenantId),
        ),
      )
      .limit(1);

    return row ? this.toEntity(row) : null;
  }

  async findAll(tenantId: string, filter: ListTransactionsFilter): Promise<PaginatedResult<TransactionEntity>> {
    const offset = (filter.page - 1) * filter.limit;

    const where = and(
      eq(transactionsTable.tenantId, tenantId),
      filter.status ? eq(transactionsTable.status, filter.status) : undefined,
      filter.source ? eq(transactionsTable.source, filter.source) : undefined,
    );

    const [rows, [countRow]] = await Promise.all([
      this.db
        .select()
        .from(transactionsTable)
        .where(where)
        .orderBy(desc(transactionsTable.createdAt))
        .limit(filter.limit)
        .offset(offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(transactionsTable)
        .where(where),
    ]);

    const total = countRow?.total ?? 0;

    return {
      data: rows.map((row) => this.toEntity(row)),
      meta: {
        total,
        page: filter.page,
        limit: filter.limit,
        totalPages: Math.ceil(total / filter.limit),
      },
    };
  }

  async updateStatus(id: UuidVO, tenantId: string, status: TransactionStatus, tx?: unknown): Promise<void> {
    const db = (tx as DrizzleDb | undefined) ?? this.db;
    await db
      .update(transactionsTable)
      .set({
        status,
        updatedAt: new Date(),
        processedAt: status === TransactionStatus.COMPLETED ? new Date() : undefined,
      })
      .where(
        and(
          eq(transactionsTable.id, id.toString()),
          eq(transactionsTable.tenantId, tenantId),
        ),
      );
  }

  async withTransaction<T>(work: (tx: unknown) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => work(tx));
  }

  private toEntity(row: TransactionRow): TransactionEntity {
    return TransactionEntity.reconstitute({
      id: row.id,
      tenantId: row.tenantId,
      idempotencyKey: row.idempotencyKey,
      amountInCents: row.amount,
      currency: row.currency,
      source: row.source as TransactionSource,
      description: row.description ?? null,
      status: row.status as TransactionStatus,
      externalRef: row.externalRef ?? null,
      metadata: (row.metadata as Record<string, unknown>) ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      processedAt: row.processedAt ?? null,
    });
  }
}
