import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Client } from 'pg';
import { Logger } from 'nestjs-pino';
import { AppModule } from './../src/app.module';
import { DomainExceptionFilter } from '../src/shared/infrastructure/filters/domain-exception.filter';

loadEnv({ path: resolve(__dirname, '../../.env') });

type AuthResponse = {
  data: {
    accessToken: string;
    expiresIn: string;
  };
};

type RegisterResponse = {
  data: {
    userId: string;
    email: string;
  };
};

type TransactionResponse = {
  data: {
    id: string;
    tenantId: string;
    amountInCents: number;
    currency: string;
    source: string;
    description: string | null;
    status: string;
    externalRef: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    updatedAt: string;
    processedAt: string | null;
    entries?: Array<{
      id: string;
      transactionId: string;
      type: string;
      amountInCents: number;
      description: string | null;
      createdAt: string;
    }>;
  };
  cached?: boolean;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env var for e2e: ${name}`);
  }
  return value;
}

describe('Transactions API (e2e)', () => {
  let app: INestApplication;
  let db: Client;

  beforeAll(async () => {
    db = new Client({
      host: requiredEnv('POSTGRES_HOST'),
      port: Number(requiredEnv('POSTGRES_PORT')),
      user: requiredEnv('POSTGRES_USER'),
      password: requiredEnv('POSTGRES_PASSWORD'),
      database: requiredEnv('POSTGRES_DB'),
    });

    await db.connect();
  });

  beforeEach(async () => {
    await resetDatabase();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useLogger(app.get(Logger));
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await resetDatabase();
    await db.end();
  });

  it('authenticates, creates a transaction, retries idempotently and serializes concurrent requests', async () => {
    const email = `tenant-${Date.now()}@example.com`;
    const password = 'StrongPass123';
    const registrationToken = requiredEnv('REGISTRATION_SECRET');

    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .set('X-Registration-Token', registrationToken)
      .send({ email, password })
      .expect(201);

    const registered = registerResponse.body as RegisterResponse;

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    const auth = loginResponse.body as AuthResponse;
    const accessToken = auth.data.accessToken;
    const basePayload = {
      amountInCents: 12500,
      currency: 'BRL',
      source: 'MANUAL',
      description: 'Pagamento recorrente',
      metadata: { orderId: 'order-123' },
    };

    const initialKey = randomUUID();

    const createResponse = await request(app.getHttpServer())
      .post('/transactions')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Idempotency-Key', initialKey)
      .set('X-Correlation-Id', 'corr-initial-create')
      .send(basePayload)
      .expect(201);

    expect(createResponse.headers['x-correlation-id']).toBe('corr-initial-create');

    const created = createResponse.body as TransactionResponse;

    const retryResponse = await request(app.getHttpServer())
      .post('/transactions')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Idempotency-Key', initialKey)
      .send(basePayload)
      .expect(200);

    const retried = retryResponse.body as TransactionResponse;

    expect(retried.cached).toBe(true);
    expect(retried.data.id).toBe(created.data.id);
    expect(retried.data.tenantId).toBe(registered.data.userId);

    const detailResponse = await request(app.getHttpServer())
      .get(`/transactions/${created.data.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const detail = detailResponse.body as TransactionResponse;
    expect(detail.data.entries).toHaveLength(2);

    const listResponse = await request(app.getHttpServer())
      .get('/transactions?page=1&limit=10')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(listResponse.body.data).toHaveLength(1);

    const concurrentKey = randomUUID();
    const concurrentRequests = Array.from({ length: 6 }, () =>
      request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Idempotency-Key', concurrentKey)
        .send({
          ...basePayload,
          description: 'Carga concorrente',
          metadata: { orderId: 'order-concurrent' },
        }),
    );

    const concurrentResponses = await Promise.all(concurrentRequests);
    const createdResponses = concurrentResponses.filter((response) => response.status === 201);
    const idempotentResponses = concurrentResponses.filter(
      (response) => response.status === 200 && response.body.cached === true,
    );
    const transactionIds = new Set(
      concurrentResponses.map((response) => (response.body as TransactionResponse).data.id),
    );

    expect(createdResponses).toHaveLength(1);
    expect(idempotentResponses).toHaveLength(5);
    expect(concurrentResponses.every((response) => response.status !== 409)).toBe(true);
    expect(transactionIds.size).toBe(1);

    const concurrentTransactionId = [...transactionIds][0];
    const transactionRows = await db.query(
      'select id, tenant_id from transactions where idempotency_key = $1',
      [concurrentKey],
    );
    const entryRows = await db.query(
      'select tenant_id from transaction_entries where transaction_id = $1 order by created_at asc',
      [concurrentTransactionId],
    );

    expect(transactionRows.rowCount).toBe(1);
    expect(transactionRows.rows[0]?.tenant_id).toBe(registered.data.userId);
    expect(entryRows.rowCount).toBe(2);
    expect(entryRows.rows.every((row) => row.tenant_id === registered.data.userId)).toBe(true);
  });

  async function resetDatabase(): Promise<void> {
    await db.query('TRUNCATE TABLE transaction_entries, transactions, idempotency_keys, users RESTART IDENTITY CASCADE');
  }
});
