# Hyper Finance

Primeira versão funcional de um módulo de transações financeiras multi-tenant.

O que está implementado hoje:

- API NestJS com TypeScript em `strict`
- Persistência em PostgreSQL via Drizzle ORM
- Idempotência por `tenantId + idempotencyKey`
- Split contábil em `transaction_entries`
- Isolamento de tenant em `transactions` e `transaction_entries`
- Frontend React para listar e criar transações
- Cache Redis de listagem por 30s
- Logs estruturados com `correlationId`
- Teste e2e real cobrindo auth, retry idempotente e concorrência simultânea

## Estrutura

- `apps/api`: NestJS, casos de uso, repositórios Drizzle, BullMQ, Redis
- `apps/web`: Vite, React, TanStack Router, React Query
- `packages/ui`: componentes compartilhados do frontend
- `infra/terraform`: plano fictício de deploy em AWS

## Como rodar

Pré-requisitos: Node 20+, pnpm, Docker.

```bash
cd monorepo
pnpm install
docker compose up -d
pnpm --filter api run db:migrate
pnpm --filter api run start:dev
pnpm --filter @hyper/web run dev
```

URLs locais:

- API: `http://localhost:3333`
- Swagger: `http://localhost:3333/docs`
- Frontend: `http://localhost:3000`
- Bull Board: `http://localhost:3333/queues`

## Endpoints

| Método | Rota | Observação |
|--------|------|------------|
| `POST` | `/auth/register` | exige `X-Registration-Token` |
| `POST` | `/auth/login` | retorna JWT |
| `POST` | `/transactions` | exige JWT + `X-Idempotency-Key` |
| `GET` | `/transactions` | lista paginada do tenant autenticado |
| `GET` | `/transactions/:id` | retorna transação + entries do tenant |
| `GET` | `/health/live` | liveness |
| `GET` | `/health/ready` | readiness |

## Idempotência

Implementação atual:

- chave única por `tenant_id + key` na tabela `idempotency_keys`
- primeira requisição faz `insert ... on conflict do nothing`
- retry após falha usa `update ... where status = 'FAILED'`
- apenas uma requisição consegue promover `FAILED -> PROCESSING`
- requisições simultâneas com a mesma chave esperam o resultado por janela curta e retornam a mesma transação já criada em vez de duplicar escrita
- se o processamento ainda não terminou após a janela de espera, a API responde `409 IDEMPOTENCY_CONFLICT`

Resultado prático validado em e2e: 1 `201 Created` + demais `200 OK` com `cached: true` para a mesma `idempotencyKey` concorrente.

## Multi-tenancy

Isolamento atual:

- `users`, `transactions` e `transaction_entries` armazenam `tenant_id`
- `GET /transactions` e `GET /transactions/:id` filtram por tenant autenticado
- busca de `transaction_entries` filtra por `transaction_id` e `tenant_id`
- o e2e valida que as entries gravadas carregam o `tenant_id` correto

Limite consciente: hoje `tenantId = userId`. Isso simplifica o desafio, mas não modela uma entidade `Tenant` separada.

## Observabilidade

Implementado no código:

- `CorrelationIdInterceptor` gera ou propaga `X-Correlation-Id`
- logs estruturados de request start/finish
- logs de negócio com `tenantId`, `transactionId`, `idempotencyKey`
- filtro global de exceção com `error` e `stack`
- logs do worker BullMQ e do cleanup de idempotência

Não está implementado:

- métricas Prometheus
- tracing distribuído com OpenTelemetry
- dashboards/alertas

## Cache

Cache implementado hoje:

- `GET /transactions` usa Redis com TTL de 30 segundos
- chave inclui tenant, página, limite, status e source
- `POST /transactions` invalida o prefixo `tx:list:<tenantId>:*`

Onde eu colocaria cache:

- na listagem, como já está implementado

Onde eu não colocaria cache:

- no `POST /transactions`
- no caminho de escrita da idempotência
- em qualquer leitura que precise refletir saldo financeiro forte imediatamente

## Filas

BullMQ está presente, mas com papel limitado e real:

- a API publica `transaction.completed` após criar a transação
- o worker atual apenas registra o evento e executa cleanup de chaves expiradas

Quando eu usaria mensageria de forma mais pesada:

- notificação de parceiros externos
- webhooks
- conciliação assíncrona
- retentativas de integrações externas

Quando eu não usaria fila:

- validação síncrona da requisição
- reserva da idempotência
- gravação inicial da transação

## Organização

Escolhi `domain -> application -> infrastructure` porque o problema central do desafio está em consistência e concorrência, não no framework.

- `domain`: entidades e value objects
- `application`: casos de uso e portas
- `infrastructure`: HTTP, banco, cache, fila

Isso permitiu testar a regra de idempotência e o split sem depender de Nest ou PostgreSQL em todos os cenários.

## Testes

Comandos úteis:

```bash
cd monorepo
pnpm --filter api run check-types
pnpm --filter @hyper/web run check-types
pnpm --filter api exec jest --runInBand
pnpm --filter api exec jest --config ./test/jest-e2e.json --runInBand
```

Status validado nesta revisão:

- API compilando em `strict`
- frontend compilando em `strict`
- suíte da API: 33 suites, 184 testes passando
- e2e real passando contra PostgreSQL local

## Gargalo

O gargalo principal continua sendo o caminho síncrono de escrita no PostgreSQL.

Cada `POST /transactions` faz:

- aquisição/atualização de idempotência
- insert em `transactions`
- insert em `transaction_entries`
- update de status
- update final de idempotência

Sob pico alto, o primeiro problema real tende a ser contenção no banco e saturação do pool de conexões.

## Prioridade em produção

A primeira priorização seria reduzir tempo de retenção da conexão no request crítico:

1. manter o caminho síncrono só para reserva idempotente + escrita principal
2. mover efeitos secundários reais para worker
3. introduzir rate limit por tenant
4. medir latência de banco e fila antes de qualquer otimização mais cara

## Dívida técnica consciente

- `tenantId = userId`, sem entidade `Tenant` separada
- sem métricas e tracing distribuído
- sem rate limiting por tenant
- sem cursor pagination
- worker BullMQ ainda sem integração externa real
- frontend sem testes automatizados

## Referências

- desafio: `../docs/CHALLENGE.md`
- arquitetura geral: `../docs/ARCHITECTURE.md`


