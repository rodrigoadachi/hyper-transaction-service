import { Redis } from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

export interface RedisConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
}

/**
 * Creates an ioredis client configured for use with BullMQ.
 * `maxRetriesPerRequest: null` is required by BullMQ workers.
 * `enableReadyCheck: false` allows BullMQ to connect before Redis sends READY.
 */
export function createRedisClient(config: RedisConfig): Redis {
  return new Redis({
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}
