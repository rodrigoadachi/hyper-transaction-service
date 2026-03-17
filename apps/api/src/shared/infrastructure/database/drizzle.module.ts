import { Module, Global, Inject, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import type { Env } from '../../../config/env';
import {
  DRIZZLE_TOKEN,
  createDrizzlePool,
  createDrizzleDb,
  type DrizzlePoolConfig,
} from './drizzle.provider';

@Global()
@Module({
  providers: [
    {
      provide: 'PG_POOL',
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): ReturnType<typeof createDrizzlePool> => {
        const poolConfig: DrizzlePoolConfig = {
          host: config.getOrThrow('POSTGRES_HOST'),
          port: config.getOrThrow('POSTGRES_PORT'),
          user: config.getOrThrow('POSTGRES_USER'),
          password: config.getOrThrow('POSTGRES_PASSWORD'),
          database: config.getOrThrow('POSTGRES_DB'),
        };
        return createDrizzlePool(poolConfig);
      },
    },
    {
      provide: DRIZZLE_TOKEN,
      inject: ['PG_POOL'],
      useFactory: (pool: Pool) => createDrizzleDb(pool),
    },
  ],
  exports: [DRIZZLE_TOKEN],
})

export class DrizzleModule implements OnApplicationShutdown {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
