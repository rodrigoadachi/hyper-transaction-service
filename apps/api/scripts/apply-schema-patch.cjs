/**
 * Script temporário para aplicar o patch de schema (fase 1 do rewrite).
 * Adiciona: source, description em transactions; cria transaction_entries.
 * Remove: coluna type (transaction_type enum).
 */
const path = require('node:path');
const dotenv = require('dotenv');
const { Client } = require('pg');

const monorepoRoot = path.resolve(__dirname, '../../..');
dotenv.config({ path: path.join(monorepoRoot, '.env') });
dotenv.config({ path: path.join(monorepoRoot, '.env.local'), override: true });

async function main() {
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
  });

  await client.connect();
  console.log('Connected to PostgreSQL');

  try {
    // 1. Criar enum transaction_source (se não existir)
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE "transaction_source" AS ENUM('WEBHOOK', 'MANUAL');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    console.log('✓ enum transaction_source');

    // 2. Criar enum transaction_entry_type (se não existir)
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE "transaction_entry_type" AS ENUM('PLATFORM_FEE', 'TENANT_REVENUE');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    console.log('✓ enum transaction_entry_type');

    // 3. Adicionar coluna source em transactions (se não existir)
    await client.query(`
      ALTER TABLE transactions
        ADD COLUMN IF NOT EXISTS "source" "transaction_source" NOT NULL DEFAULT 'MANUAL';
    `);
    console.log('✓ column transactions.source');

    // 4. Adicionar coluna description em transactions (se não existir)
    await client.query(`
      ALTER TABLE transactions
        ADD COLUMN IF NOT EXISTS "description" varchar(255);
    `);
    console.log('✓ column transactions.description');

    // 5. Remover coluna type se ainda existir
    const { rows } = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'transactions' AND column_name = 'type';
    `);
    if (rows.length > 0) {
      await client.query(`ALTER TABLE transactions DROP COLUMN IF EXISTS "type";`);
      console.log('✓ dropped column transactions.type');
    } else {
      console.log('- column transactions.type already absent');
    }

    // 6. Criar tabela transaction_entries (se não existir)
    await client.query(`
      CREATE TABLE IF NOT EXISTS "transaction_entries" (
        "id" uuid PRIMARY KEY NOT NULL,
        "transaction_id" uuid NOT NULL REFERENCES "transactions"("id"),
        "type" "transaction_entry_type" NOT NULL,
        "amount" integer NOT NULL,
        "description" varchar(255),
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    console.log('✓ table transaction_entries');

    // 7. Criar index em transaction_entries (se não existir)
    await client.query(`
      CREATE INDEX IF NOT EXISTS "idx_transaction_entries_transaction"
        ON "transaction_entries" ("transaction_id");
    `);
    console.log('✓ index idx_transaction_entries_transaction');

    console.log('\n✅ Schema patch applied successfully!');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
