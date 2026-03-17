import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

export const idempotencyKeysTable = pgTable(
  'idempotency_keys',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    key: varchar('key', { length: 255 }).notNull(),
    resultId: uuid('result_id'),
    status: varchar('status', { length: 20 }).notNull().default('PROCESSING'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex('idx_idempotency_tenant_key').on(t.tenantId, t.key),
    index('idx_idempotency_expires_at').on(t.expiresAt),
  ],
);

export type IdempotencyKeyRow = typeof idempotencyKeysTable.$inferSelect;
export type NewIdempotencyKeyRow = typeof idempotencyKeysTable.$inferInsert;
