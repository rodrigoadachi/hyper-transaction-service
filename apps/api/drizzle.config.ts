import { defineConfig } from 'drizzle-kit';

// .env is loaded by dotenv-cli in npm scripts (see package.json db:* scripts).
export default defineConfig({
  schema: './src/shared/infrastructure/database/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.POSTGRES_HOST ?? '',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: process.env.POSTGRES_USER ?? '',
    password: process.env.POSTGRES_PASSWORD ?? '',
    database: process.env.POSTGRES_DB ?? '',
  },
  verbose: true,
  strict: true,
});
