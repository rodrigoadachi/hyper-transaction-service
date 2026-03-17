import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

export const DRIZZLE_TOKEN = Symbol('DrizzleDb');

export interface DrizzlePoolConfig {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly database: string;
}

export const createDrizzlePool = (config: DrizzlePoolConfig): Pool => new Pool({
  host: config.host,
  port: config.port,
  user: config.user,
  password: config.password,
  database: config.database,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export const createDrizzleDb = (pool: Pool): DrizzleDb => drizzle(pool, { schema });
