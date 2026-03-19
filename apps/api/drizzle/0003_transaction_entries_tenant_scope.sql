ALTER TABLE "transaction_entries" ADD COLUMN IF NOT EXISTS "tenant_id" uuid;--> statement-breakpoint
UPDATE "transaction_entries" AS te
SET "tenant_id" = t."tenant_id"
FROM "transactions" AS t
WHERE te."transaction_id" = t."id"
  AND te."tenant_id" IS NULL;--> statement-breakpoint
ALTER TABLE "transaction_entries" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_transaction_entries_tenant_transaction" ON "transaction_entries" USING btree ("tenant_id", "transaction_id");