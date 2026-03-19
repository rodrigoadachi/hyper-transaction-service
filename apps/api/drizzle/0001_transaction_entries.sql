CREATE TYPE "public"."transaction_source" AS ENUM('WEBHOOK', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."transaction_entry_type" AS ENUM('PLATFORM_FEE', 'TENANT_REVENUE');--> statement-breakpoint
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "type";--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "source" "transaction_source" NOT NULL DEFAULT 'MANUAL';--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "description" varchar(255);--> statement-breakpoint
DROP TYPE IF EXISTS "public"."transaction_type";--> statement-breakpoint
CREATE TABLE "transaction_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"transaction_id" uuid NOT NULL,
	"type" "transaction_entry_type" NOT NULL,
	"amount" integer NOT NULL,
	"description" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transaction_entries" ADD CONSTRAINT "transaction_entries_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_transaction_entries_transaction" ON "transaction_entries" USING btree ("transaction_id");
