const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dotenv = require('dotenv');
const { Client } = require('pg');

const appRoot = path.resolve(__dirname, '..');
const monorepoRoot = path.resolve(appRoot, '../..');

// Load monorepo env files with local override support.
dotenv.config({ path: path.join(monorepoRoot, '.env') });
dotenv.config({ path: path.join(monorepoRoot, '.env.local'), override: true });

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function ensureMigrationsTable(client) {
  await client.query('create schema if not exists drizzle');
  await client.query(`
    create table if not exists drizzle.__drizzle_migrations (
      id serial primary key,
      hash text not null unique,
      created_at bigint not null,
      name text not null
    )
  `);

  // Compatibility with older/local tables created before this script existed.
  await client.query("alter table drizzle.__drizzle_migrations add column if not exists name text");
  await client.query("update drizzle.__drizzle_migrations set name = coalesce(name, '') where name is null");
  await client.query("alter table drizzle.__drizzle_migrations alter column name set not null");
  await client.query(
    'create unique index if not exists idx_drizzle_migrations_hash on drizzle.__drizzle_migrations(hash)',
  );
}

function getMigrationEntries() {
  const journalPath = path.join(appRoot, 'drizzle', 'meta', '_journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));

  if (!Array.isArray(journal.entries)) {
    throw new Error('Invalid drizzle meta journal: entries is not an array');
  }

  return [...journal.entries].sort((a, b) => Number(a.idx) - Number(b.idx));
}

function readMigrationSql(tag) {
  const migrationPath = path.join(appRoot, 'drizzle', `${tag}.sql`);
  return fs.readFileSync(migrationPath, 'utf8');
}

function hashMigration(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function extractCreatedObjects(sql) {
  const tables = [];
  const types = [];

  const createTableRegex = /create\s+table\s+"(?:(\w+)"\.)?"(\w+)"/gi;
  const createTypeRegex = /create\s+type\s+"(?:(\w+)"\.)?"(\w+)"/gi;

  let match = createTableRegex.exec(sql);
  while (match) {
    tables.push({ schema: match[1] || 'public', name: match[2] });
    match = createTableRegex.exec(sql);
  }

  match = createTypeRegex.exec(sql);
  while (match) {
    types.push({ schema: match[1] || 'public', name: match[2] });
    match = createTypeRegex.exec(sql);
  }

  return { tables, types };
}

async function objectsAlreadyExist(client, sql) {
  const { tables, types } = extractCreatedObjects(sql);

  for (const table of tables) {
    const result = await client.query('select to_regclass($1) as name', [`${table.schema}.${table.name}`]);
    if (!result.rows[0] || !result.rows[0].name) {
      return false;
    }
  }

  for (const typeObj of types) {
    const result = await client.query(
      `
        select 1
        from pg_type t
        join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = $1 and t.typname = $2
        limit 1
      `,
      [typeObj.schema, typeObj.name],
    );
    if (result.rowCount === 0) {
      return false;
    }
  }

  return true;
}

async function applyMigrations() {
  const client = new Client({
    host: requiredEnv('POSTGRES_HOST'),
    port: Number(process.env.POSTGRES_PORT ?? '5432'),
    user: requiredEnv('POSTGRES_USER'),
    password: requiredEnv('POSTGRES_PASSWORD'),
    database: requiredEnv('POSTGRES_DB'),
  });

  await client.connect();

  try {
    await ensureMigrationsTable(client);
    const entries = getMigrationEntries();

    for (const entry of entries) {
      const tag = String(entry.tag);
      const sql = readMigrationSql(tag);
      const hash = hashMigration(sql);

      const existing = await client.query(
        'select 1 from drizzle.__drizzle_migrations where hash = $1 limit 1',
        [hash],
      );

      if (existing.rowCount > 0) {
        console.log(`skip ${tag} (already applied)`);
        continue;
      }

      console.log(`apply ${tag}`);
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query(
          'insert into drizzle.__drizzle_migrations (hash, created_at, name) values ($1, $2, $3)',
          [hash, Date.now(), tag],
        );
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');

        const pgCode = error && typeof error === 'object' ? error.code : undefined;
        const isAlreadyExistsError = pgCode === '42710' || pgCode === '42P07';

        if (isAlreadyExistsError && (await objectsAlreadyExist(client, sql))) {
          await client.query(
            'insert into drizzle.__drizzle_migrations (hash, created_at, name) values ($1, $2, $3) on conflict (hash) do nothing',
            [hash, Date.now(), tag],
          );
          console.log(`mark ${tag} as applied (objects already existed)`);
          continue;
        }

        throw error;
      }
    }

    console.log('migrations complete');
  } finally {
    await client.end();
  }
}

applyMigrations().catch((error) => {
  console.error(error);
  process.exit(1);
});
