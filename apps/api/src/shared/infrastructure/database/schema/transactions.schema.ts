import {
  pgTable,
  uuid,
  varchar,
  bigint,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';

export const transactionSourceEnum = pgEnum('transaction_source', [
  'WEBHOOK',
  'MANUAL',
]);

export const transactionStatusEnum = pgEnum('transaction_status', [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
]);

export const transactionEntryTypeEnum = pgEnum('transaction_entry_type', [
  'PLATFORM_FEE',
  'TENANT_REVENUE',
]);

export const transactionsTable = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    source: transactionSourceEnum('source').notNull().default('MANUAL'),
    description: varchar('description', { length: 255 }),
    status: transactionStatusEnum('status').notNull().default('PENDING'),
    externalRef: varchar('external_ref', { length: 255 }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('idx_transactions_idempotency').on(t.tenantId, t.idempotencyKey),
    index('idx_transactions_tenant_created').on(t.tenantId, t.createdAt),
    index('idx_transactions_tenant_status').on(t.tenantId, t.status),
  ],
);

export const transactionEntriesTable = pgTable(
  'transaction_entries',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => transactionsTable.id),
    type: transactionEntryTypeEnum('type').notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    description: varchar('description', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_transaction_entries_transaction').on(t.transactionId),
    index('idx_transaction_entries_tenant_transaction').on(t.tenantId, t.transactionId),
  ],
);

export type TransactionRow = typeof transactionsTable.$inferSelect;
export type NewTransactionRow = typeof transactionsTable.$inferInsert;
export type TransactionEntryRow = typeof transactionEntriesTable.$inferSelect;
export type NewTransactionEntryRow = typeof transactionEntriesTable.$inferInsert;
