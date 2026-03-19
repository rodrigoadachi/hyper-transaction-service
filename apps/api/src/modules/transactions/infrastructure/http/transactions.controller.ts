import {
  Body,
  Controller,
  Get,
  Headers,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../../../auth/infrastructure/jwt/jwt-auth.guard';
import { CreateTransactionUseCase } from '../../application/use-cases/create-transaction.use-case';
import { ListTransactionsUseCase } from '../../application/use-cases/list-transactions.use-case';
import { GetTransactionUseCase } from '../../application/use-cases/get-transaction.use-case';
import { ZodValidationPipe } from '../../../../shared/infrastructure/pipes/zod-validation.pipe';
import { createTransactionSchema, type CreateTransactionDto } from './dtos/create-transaction.dto';
import { listTransactionsSchema, type ListTransactionsDto } from './dtos/list-transactions.dto';
import type { TransactionEntity } from '../../domain/entities/transaction.entity';
import type { TransactionEntryEntity } from '../../domain/entities/transaction-entry.entity';

interface JwtUser {
  sub: string;
  email: string;
}

interface RequestWithUser extends Request {
  user: JwtUser;
}

interface TransactionEntryResponseDto {
  id: string;
  transactionId: string;
  type: string;
  amountInCents: number;
  description: string | null;
  createdAt: string;
}

interface TransactionResponseDto {
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
}

function toResponse(tx: TransactionEntity): TransactionResponseDto {
  return {
    id: tx.id.toString(),
    tenantId: tx.tenantId,
    amountInCents: tx.amountInCents,
    currency: tx.currency,
    source: tx.source,
    description: tx.description,
    status: tx.status,
    externalRef: tx.externalRef,
    metadata: tx.metadata,
    createdAt: tx.createdAt.toISOString(),
    updatedAt: tx.updatedAt.toISOString(),
    processedAt: tx.processedAt?.toISOString() ?? null,
  };
}

function toEntryResponse(entry: TransactionEntryEntity): TransactionEntryResponseDto {
  return {
    id: entry.id.toString(),
    transactionId: entry.transactionId,
    type: entry.type,
    amountInCents: entry.amountInCents,
    description: entry.description,
    createdAt: entry.createdAt.toISOString(),
  };
}

@ApiTags('transactions')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly createTransactionUseCase: CreateTransactionUseCase,
    private readonly listTransactionsUseCase: ListTransactionsUseCase,
    private readonly getTransactionUseCase: GetTransactionUseCase,
  ) {}

  // ── POST /transactions ───────────────────────────────────────────────────
  @Post()
  @ApiOperation({
    summary: 'Criar transação financeira',
    description:
      'Recebe e persiste uma transação financeira.\n\n' +
      '**Idempotência:** o header `X-Idempotency-Key` é obrigatório. ' +
      'Requisições com a mesma chave retornam a transação original sem criar duplicatas.',
  })
  @ApiHeader({
    name: 'X-Idempotency-Key',
    description: 'Chave única para garantir idempotência (UUID recomendado, max 255 chars)',
    required: true,
    example: '01945cf0-0000-7000-8000-000000000001',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['amountInCents', 'currency', 'type'],
      properties: {
        amountInCents: { type: 'integer', example: 15000, description: 'Valor em centavos (ex: 15000 = R$150,00)' },
        currency: { type: 'string', example: 'BRL', description: 'Código ISO 4217 de 3 letras' },
        type: { type: 'string', enum: ['CREDIT', 'DEBIT'], example: 'CREDIT' },
        externalRef: { type: 'string', example: 'order-abc-123', description: 'Referência externa opcional' },
        metadata: { type: 'object', example: { orderId: 'abc-123' }, description: 'Dados extras (JSONB)' },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Transação criada com sucesso (HTTP 201)' })
  @ApiOkResponse({ description: 'Transação já processada — resposta idempotente (HTTP 200, cached: true)' })
  @ApiConflictResponse({ description: 'Transação em processamento concorrente (HTTP 409, code: IDEMPOTENCY_CONFLICT)' })
  @ApiUnprocessableEntityResponse({ description: 'Falha de validação ou header X-Idempotency-Key ausente' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  async create(
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
    @Headers('x-idempotency-key') rawKey: string | undefined,
    @Body(new ZodValidationPipe(createTransactionSchema)) dto: CreateTransactionDto,
  ): Promise<{ data: TransactionResponseDto; cached?: boolean }> {
    if (!rawKey || rawKey.trim().length === 0) {
      throw new UnprocessableEntityException({
        message: 'X-Idempotency-Key header is required',
        code: 'MISSING_IDEMPOTENCY_KEY',
      });
    }

    const idempotencyKey = rawKey.trim();

    if (idempotencyKey.length > 255) {
      throw new UnprocessableEntityException({
        message: 'X-Idempotency-Key must not exceed 255 characters',
        code: 'INVALID_IDEMPOTENCY_KEY',
      });
    }

    const result = await this.createTransactionUseCase.execute({
      tenantId: req.user.sub,
      idempotencyKey,
      amountInCents: dto.amountInCents,
      currency: dto.currency,
      source: dto.source,
      description: dto.description,
      externalRef: dto.externalRef,
      metadata: dto.metadata,
    });

    if (result.idempotent) {
      res.status(HttpStatus.OK);
      return { data: toResponse(result.transaction), cached: true };
    }

    res.status(HttpStatus.CREATED);
    return { data: toResponse(result.transaction) };
  }

  // ── GET /transactions ────────────────────────────────────────────────────
  @Get()
  @ApiOperation({ summary: 'Listar transações do tenant', description: 'Retorna todas as transações do tenant autenticado com paginação.' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] })
  @ApiQuery({ name: 'source', required: false, enum: ['WEBHOOK', 'MANUAL'] })
  @ApiOkResponse({ description: 'Lista de transações com metadata de paginação' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  async list(
    @Req() req: RequestWithUser,
    @Query(new ZodValidationPipe(listTransactionsSchema)) query: ListTransactionsDto,
  ) {
    const result = await this.listTransactionsUseCase.execute({
      tenantId: req.user.sub,
      page: query.page,
      limit: query.limit,
      status: query.status,
      source: query.source,
    });

    return {
      data: result.data.map(toResponse),
      meta: result.meta,
    };
  }

  // ── GET /transactions/:id ────────────────────────────────────────────────
  @Get(':id')
  @ApiOperation({ summary: 'Buscar transação por ID', description: 'Retorna uma transação específica do tenant autenticado.' })
  @ApiOkResponse({ description: 'Transação encontrada' })
  @ApiNotFoundResponse({ description: 'Transação não encontrada ou pertence a outro tenant' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  async getById(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    const { transaction, entries } = await this.getTransactionUseCase.execute({
      id,
      tenantId: req.user.sub,
    });

    return { data: { ...toResponse(transaction), entries: entries.map(toEntryResponse) } };
  }
}
