# Hyper Finance — Transaction Service

Serviço de processamento de transações financeiras multi-tenant (SaaS B2B).
Realiza split automático de pagamentos: 90% receita do tenant + 10% taxa de plataforma,
com idempotência garantida por chave única por tenant.

## Arquitetura

- **Monorepo Turborepo** — build e tasks orquestrados via `turbo.json`
- **`apps/api`** — NestJS + Clean Architecture (domain / application / infrastructure) + Drizzle ORM + PostgreSQL 17
- **`apps/web`** — Vite + React + TanStack Router + React Query

Detalhes em [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) e [docs/CHALLENGE.md](../docs/CHALLENGE.md).

## Como rodar

**Pré-requisitos:** Docker, Node.js 24 (LTS ativo), pnpm.

```bash
# 1. Copie e edite as variáveis de ambiente
cp apps/api/.env.example apps/api/.env

# 2. Suba o banco e o Redis
docker compose up -d

# 3. Instale as dependências
pnpm install

# 4. Aplique as migrations
pnpm --filter api run db:migrate

# 5. Inicie a API em modo watch
pnpm --filter api run start:dev

# 6. (Opcional) Inicie o frontend
pnpm --filter web run dev
```

| Serviço | URL |
|---------|-----|
| API REST | `http://localhost:3333` |
| Swagger UI | `http://localhost:3333/docs` |
| Bull Board (filas) | `http://localhost:3333/queues` |
| Frontend | `http://localhost:3000` |

## Testes

```bash
# Testes unitários (use cases e domain)
pnpm --filter api run test

# Cobertura
pnpm --filter api run test:cov

# Testes e2e (requer PostgreSQL em execução)
pnpm --filter api run test:e2e
```

Os testes unitários cobrem domínio e casos de uso sem IO (mocks de ports).
Cobertura mínima: 80% em `domain/` e `application/`.

## Endpoints principais

| Método | Rota | Descrição | Header obrigatório |
|--------|------|-----------|-------------------|
| `POST` | `/auth/register` | Cria conta de tenant | — |
| `POST` | `/auth/login` | Autentica e retorna JWT | — |
| `POST` | `/transactions` | Cria transação com split | `Authorization: Bearer <token>`, `X-Idempotency-Key: <uuid>` |
| `GET` | `/transactions` | Lista transações paginadas | `Authorization: Bearer <token>` |
| `GET` | `/transactions/:id` | Detalha transação | `Authorization: Bearer <token>` |
| `GET` | `/health/live` | Liveness probe | — |
| `GET` | `/health/ready` | Readiness probe (verifica PostgreSQL) | — |

## Decisões arquiteturais

Consulte [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) para a descrição completa da arquitetura em camadas e [docs/CHALLENGE.md](../docs/CHALLENGE.md) para o contexto do desafio.

---

## Análise técnica — API

### Onde está o gargalo

O gargalo principal é a escrita síncrona e sequencial em PostgreSQL por requisição. Cada `POST /transactions` abre uma transação de banco que faz 3 inserts + 1 update em série. Sob carga paralela de múltiplos tenants, o connection pool (max 20) satura antes de qualquer limite de CPU ou rede — cada conexão fica bloqueada aguardando o `db.transaction()` completar. O segundo gargalo é a leitura sem cache: `GET /transactions` emite 2 queries (count + select) a cada requisição, sem nenhum resultado cacheado.

### Qual seria o primeiro problema real em produção

O primeiro problema real em produção seria a saturação do pool de conexões do PostgreSQL combinada com contenção no índice único de idempotência. Cada criação de transação executa uma transação síncrona com múltiplas escritas (`transactions`, `transaction_entries`, `idempotency_keys` e update de status). Sob pico de concorrência, a latência cresce rapidamente porque as requisições começam a disputar as 20 conexões disponíveis e o mesmo índice composto (`tenant_id`, `idempotency_key`) vira ponto sensível de lock.

Existe um job de limpeza de `idempotency_keys`, mas ele é conservador por padrão (batch pequeno e execução periódica). Em tráfego alto, ele evita lixo eterno, porém não resolve sozinho o gargalo de escrita nem garante que a tabela permaneça pequena sem ajuste de throughput.

### Qual solução priorizar primeiro e por quê

Eu priorizaria desacoplar os efeitos pós-criação do caminho síncrono e preservar no request apenas o trecho estritamente transacional: aquisição da idempotência, gravação da transação e commit. O ganho imediato é reduzir tempo de retenção da conexão e melhorar throughput sem enfraquecer consistência.

Na sequência, ajustaria o cleanup de `idempotency_keys` para o volume real de tráfego e adicionaria métricas do pool/latência para calibrar capacidade antes de introduzir otimizações mais caras.

---

## Análise técnica — Frontend

### Por que organizou o projeto dessa forma

A estrutura segue **colocação por rota** (file-based routing do TanStack Router): cada página vive em `pages/_authenticated/` com seu próprio estado, query e mutação. Isso evita prop-drilling e torna cada rota independente para crescer, testar ou remover sem afetar as outras. O estado global se limita ao token de auth (contexto do router) — o resto é estado de servidor gerenciado pelo React Query.

### Onde colocaria cache — e quando não colocaria

**Colocaria:** na listagem de transações (`GET /transactions`), com `staleTime` de 30–60 s no React Query — o dado é lido com muito mais frequência do que é escrito, e uma defasagem pequena é aceitável para o usuário. No servidor, Redis com TTL curto para respostas de listagem por tenant.

**Não colocaria:** no `POST /transactions` (escrita com efeito colateral financeiro — qualquer cache aqui quebra idempotência) e em `GET /transactions/:id` logo após uma criação (o usuário espera ver o dado atualizado imediatamente — deve-se invalidar via `queryClient.invalidateQueries` em vez de servir cache).

### Como garantiria observabilidade em produção

- **Logs estruturados** já estão em Pino com `event`, `tenantId` e contexto de negócio nos pontos críticos — encaminhados para um aggregator (Datadog, Loki, CloudWatch).
- **Métricas:** expor endpoint `/metrics` (Prometheus) com: latência por rota (p50/p95/p99), taxa de erro por status code, tamanho da connection pool e fila de jobs.
- **Tracing/correlação:** adicionar `requestId` por requisição e instrumentar com OpenTelemetry para correlacionar HTTP → use case → query de banco em um único trace distribuído.
- **Alertas:** SLO de p99 < 500 ms e taxa de erro 5xx < 0,1%; alerta imediato se `transaction.failed` subir acima do baseline por tenant.

### Em que cenário usaria fila/mensageria

Quando o processamento de uma transação precisar disparar efeitos externos (notificar sistema parceiro, enviar e-mail de confirmação, acionar webhook para o tenant). O fluxo atual é síncrono e retorna só quando tudo escreveu no banco — certo para a criação da transação em si, mas incorreto para efeitos secundários que podem falhar por razões externas. BullMQ (já preparado no docker-compose) publicaria um job `transaction.completed` após o commit; workers independentes consumiriam sem afetar a latência da API.

### O que deixaria como dívida técnica consciente

| Item | Motivo de deixar por ora |
|------|--------------------------|
| Refresh token / rotação de JWT | A sessão expira em 15 min; aceitável para o MVP, mas exige implementação antes de produção real |
| Ajuste fino do cleanup de `idempotency_keys` | O job já existe, mas precisa ser calibrado com batch/intervalo compatíveis com o volume real para evitar crescimento excessivo da tabela |
| Paginação cursor-based | `OFFSET` funciona até ~50 k registros por tenant; com volume maior, cursor com UUIDv7 ordenado é necessário |
| Rate limiting por tenant | Hoje qualquer tenant pode saturar o pool de conexões — um throttle por `tenantId` no controller resolveria |
| Testes e2e da UI | O frontend não tem nenhum teste de integração; Playwright cobre os fluxos críticos (login → criar transação → listar) |


