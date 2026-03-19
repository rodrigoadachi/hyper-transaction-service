# Hyper Finance API

Resumo operacional da API. O documento principal do projeto está em `../../README.md`.

## Stack

- NestJS
- TypeScript `strict`
- Drizzle ORM
- PostgreSQL
- Redis
- BullMQ

## O que esta API entrega

- `POST /auth/register` com `X-Registration-Token`
- `POST /auth/login` com JWT
- `POST /transactions` com idempotência por tenant
- `GET /transactions` com cache Redis de 30s
- `GET /transactions/:id` com `transaction_entries`
- logs estruturados com `correlationId`
- teste e2e real de concorrência

## Rodando localmente

```bash
cd monorepo
pnpm install
docker compose up -d
pnpm --filter api run db:migrate
pnpm --filter api run start:dev
```

## Validando

```bash
cd monorepo
pnpm --filter api run check-types
pnpm --filter api exec jest --runInBand
pnpm --filter api exec jest --config ./test/jest-e2e.json --runInBand
```

## Observações honestas

- `tenantId = userId` por simplificação do desafio
- BullMQ existe, mas ainda não processa integrações externas reais
- não há métricas Prometheus nem tracing distribuído
- o gargalo principal ainda é o caminho síncrono de escrita no PostgreSQL
