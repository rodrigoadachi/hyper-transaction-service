import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { resolve } from 'node:path';
import { LoggerModule } from 'nestjs-pino';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { DrizzleModule } from './shared/infrastructure/database/drizzle.module';
import { RedisModule } from './shared/infrastructure/redis/redis.module';
import { CorrelationIdInterceptor } from './shared/infrastructure/http/correlation-id.interceptor';
import { validateEnv, type Env } from './config/env';
import { TRANSACTIONS_QUEUE } from './modules/transactions/infrastructure/queue/transactions-queue.constants';

const monorepoRoot = resolve(process.cwd(), '../../');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(monorepoRoot, '.env.local'),
        resolve(monorepoRoot, '.env'),
        '.env.local',
        '.env',
      ],
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true, colorize: true } }
            : undefined,
        redact: {
          paths: ['req.headers.authorization', 'req.headers["x-registration-token"]'],
          censor: '[REDACTED]',
        },
        serializers: {
          req(req: { method: string; url: string }) {
            return { method: req.method, url: req.url };
          },
        },
      },
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        connection: {
          host: config.getOrThrow('REDIS_HOST'),
          port: config.getOrThrow('REDIS_PORT'),
          username: config.get('REDIS_USERNAME'),
          password: config.get('REDIS_PASSWORD'),
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        },
      }),
    }),
    BullBoardModule.forRoot({
      route: '/queues',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature({
      name: TRANSACTIONS_QUEUE,
      adapter: BullMQAdapter,
    }),
    DrizzleModule,
    RedisModule,
    AuthModule,
    HealthModule,
    TransactionsModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: CorrelationIdInterceptor,
    },
  ],
})
export class AppModule { }
