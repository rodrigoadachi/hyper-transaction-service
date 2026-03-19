# Hyper Finance — API

Serviço de processamento de transações financeiras multi-tenant (SaaS B2B).  
Stack: **NestJS 10 · TypeScript 5 strict · Drizzle ORM · PostgreSQL 17**.

---

## Rodando localmente

```bash
# Na raiz do monorepo (./monorepo/)
cp apps/api/.env.example apps/api/.env.local   # ajuste as variáveis

docker compose up -d                            # sobe PostgreSQL

pnpm --filter api run db:migrate                # aplica migrations

pnpm --filter api run start:dev                 # API em http://localhost:3333
# Swagger UI: http://localhost:3333/docs
```

---

## Endpoints de Transações

Todas as rotas exigem `Authorization: Bearer <jwt>` (obtenha via `POST /auth/login`).

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/transactions` | Criar transação (header `X-Idempotency-Key` obrigatório) |
| `GET` | `/transactions` | Listar transações (paginação + filtros) |
| `GET` | `/transactions/:id` | Buscar transação por ID |

Documentação completa em [docs/CHALLENGE.md](../../docs/CHALLENGE.md).

---

## Decisões Arquiteturais

### Por que Clean Architecture?

O domínio financeiro tem regras que mudam devagar, mas a infraestrutura muda rápido (banco, fila, cache). Separar as camadas `domain → application → infrastructure` garante que regras de negócio (Money VO, idempotência) não dependam de NestJS nem do Drizzle — podem ser testadas de forma pura, sem I/O.

O principal benefício prático: é possível trocar o repositório Drizzle por um em Redis ou outro banco sem tocar no use case. Num SaaS que vai crescer, essa troca acontece mais cedo do que se imagina.

### Onde colocaria cache? Quando não colocaria?

**Colocaria:**
- **Verificação de idempotência**: hoje é uma query ao PostgreSQL (~5 ms). Com Redis SETNX, cai para ~0.3 ms e escala horizontalmente sem contenção de lock.
- **JWT claims**: o payload do JWT é verificado a cada request. Um cache Redis por `jti`/`sub` com TTL = `expiresIn` evitaria o trabalho de parsing da assinatura ECDSA em cada hit.
- **Lista de transações** (agregados): com TTL curto (~5 s) para dashboards que polling a lista, usando tag de invalidação por `tenantId` ao criar nova transação.

**Não colocaria:**
- Na criação de transações em si: consistência > velocidade. Qualquer cache intermediário entre a escrita e a leitura pode retornar dados desatualizados em falha parcial.
- Em queries que precisam de forte consistência (ex: saldo atual derivado de transações). Cache stale em operações financeiras é inaceitável.

### Como garantiria observabilidade em produção?

1. **Logs estruturados (Pino)**: já implementados nos use cases com `event`, `transactionId`, `tenantId`, `durationMs` — sem dados sensíveis. Integração direta com Datadog, Loki ou CloudWatch Logs.
2. **Tracing distribuído**: `@opentelemetry/sdk-node` com auto-instrumentação para NestJS e `node-postgres`. Cada request recebe um `traceId` propagado via W3C Trace Context. O `traceId` é incluído nas respostas de erro 500.
3. **Métricas (Prometheus)**: contador de transações por `type`/`status`/`tenant`, histograma de duração de use cases, gauge de pool de conexões ativo. Alertas para p99 > 200 ms e taxa de erro > 1%.
4. **Health checks**: `GET /health` já existe. Adicionar verificação de conectividade ao PostgreSQL e Redis como `readiness probe` no Kubernetes.

### Em que cenário usaria fila/mensageria?

O status `PENDING` sinaliza a dívida técnica atual: a transação é criada mas não "processada". Em produção, o worker de processamento (BullMQ) seria acionado nos seguintes cenários:

- **Notificações de terceiros**: chamar APIs externas (Pix, cartão, boleto) de forma assíncrona. Evita travar o request de quem criou a transação esperando timeout de provider.
- **Retry com backoff exponencial**: falhas em integrações externas não deveriam falhar silenciosamente. O BullMQ gerencia retentativas com delay crescente.
- **Processamento em batch**: conciliar transações com extrato bancário pode ser feito em job offline sem afetar latência da API.
- **Event sourcing**: publicar eventos (`transaction.created`, `transaction.completed`) num broker (SQS, Kafka) para outros serviços (notificação, analytics, auditoria) consumirem de forma desacoplada.

**Quando não usaria fila**: na validação e criação da transação em si. O cliente precisa de confirmação síncrona imediata de que a transação foi aceita (ou rejeitada). Fazer isso via fila introduz complexidade desnecessária e impossibilita resposta adequada em caso de erro de validação.

### O que deixaria como dívida técnica consciente?

| Dívida | Motivo da decisão | Caminho de evolução |
|--------|-------------------|---------------------|
| `tenantId = userId` | Simplificação para MVP; o isolamento multi-tenant funciona corretamente, só não modela a hierarquia empresa→usuário | Entidade `Tenant` separada com FK em `User` |
| Transação criada como `PENDING` e não evolui | Sem worker implementado ainda | BullMQ worker que processa → `COMPLETED`/`FAILED` |
| Sem rate limiting por tenant | Feature não pedida no desafio | Middleware Redis INCR/EXPIRE com limite configurável por plano |
| Offset pagination | Simples de implementar | Cursor pagination via UUIDv7 para tabelas com milhões de registros |
| Sem cleanup de idempotency_keys expiradas | Não impacta corretude; só cresce a tabela | Job cron ou BullMQ scheduled para `DELETE WHERE expires_at < NOW()` |
| `metadata` sem JSONSchema | JSONB aceita qualquer estrutura | Validação por `type` de transação: cada tipo define seu schema de metadata |

---

## Onde está o gargalo nesta implementação

O gargalo principal está na **tabela `idempotency_keys`** sob alta concorrência:

1. **Dois writes por transação**: INSERT em `idempotency_keys` + INSERT em `transactions` + UPDATE em `idempotency_keys` = 3 operações por request de escrita.
2. **Pool de conexões limitado** (`max: 20`): sob spike de tráfego, requisições ficam aguardando conexão disponível. Com latência de banco de ~5 ms, 20 conexões suportam ~4.000 req/s teóricos — na prática bem menos com queries mais complexas.
3. **Lock row-level no conflito de idempotência**: quando dois requests com a mesma chave chegam simultaneamente, o segundo aguarda a conclusão do primeiro no PostgreSQL.

## Qual seria o primeiro problema real em produção

**Esgotamento do pool de conexões** num spike de tráfego. Com `max: 20` e conexões bloqueadas aguardando I/O, o pool se esgota. O resultado é latência escalando de forma não-linear: 50 ms → 500 ms → timeout → erro 500 em cascata.

## Qual solução priorizaria primeiro e por quê

**PgBouncer em modo transaction pooling** como primeira medida. Sem mudança de código, multiplica o throughput efetivo do banco mantendo poucas conexões reais. Em paralelo, migrar a verificação de idempotência para **Redis SETNX** reduz a latência do caminho crítico de ~10 ms para ~0.3 ms e remove contenção no banco para o caso mais frequente (chave nova).

Só depois disso introduziria BullMQ para processar transações de forma assíncrona, desacoplando a latência de integrações externas do tempo de resposta da API.

$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
