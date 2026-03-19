import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import {
  DRIZZLE_TOKEN,
  type DrizzleDb,
} from '../../../../shared/infrastructure/database/drizzle.provider';

const HEALTH_OK_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', example: 'ok' },
    timestamp: { type: 'string', format: 'date-time', example: '2026-03-17T12:00:00.000Z' },
  },
} as const;

const HEALTH_READY_OK_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', example: 'ok' },
    checks: {
      type: 'object',
      properties: { database: { type: 'string', example: 'ok' } },
    },
    timestamp: { type: 'string', format: 'date-time', example: '2026-03-17T12:00:00.000Z' },
  },
} as const;

const HEALTH_READY_ERROR_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', example: 'error' },
    checks: {
      type: 'object',
      properties: { database: { type: 'string', example: 'error' } },
    },
    timestamp: { type: 'string', format: 'date-time', example: '2026-03-17T12:00:00.000Z' },
  },
} as const;

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb) {}

  /**
   * Liveness probe — responde imediatamente sem dependências externas.
   * O orquestrador (ECS, Kubernetes) reinicia o contêiner se este endpoint falhar.
   */
  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Liveness probe',
    description:
      'Indica se o processo está rodando.\n\n' +
      'Não verifica dependências externas — apenas confirma que o servidor está ativo.\n\n' +
      '**Blue/Green:** use este endpoint no health check do target group AWS ALB ' +
      'com threshold de **2 falhas consecutivas** para acionar substituição de instância.',
  })
  @ApiOkResponse({ description: 'Processo ativo', schema: HEALTH_OK_SCHEMA })
  live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /**
   * Readiness probe — verifica se a aplicação está pronta para receber tráfego.
   * O load balancer para de rotear para esta instância enquanto retornar 503.
   * Usado na janela de green deployment para aguardar warmup do banco.
   */
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Readiness probe',
    description:
      'Indica se a aplicação está pronta para receber tráfego de produção.\n\n' +
      'Verifica conectividade com o PostgreSQL via `SELECT 1`.\n\n' +
      '**Blue/Green:** o load balancer deve aguardar `200` neste endpoint antes de ' +
      'migrar 100% do tráfego para a instância green. Retorna `503` enquanto o banco ' +
      'não estiver acessível (ex: durante inicialização, migrations em andamento).',
  })
  @ApiOkResponse({ description: 'Aplicação pronta para receber tráfego', schema: HEALTH_READY_OK_SCHEMA })
  @ApiServiceUnavailableResponse({
    description: 'Aplicação indisponível — banco não acessível. Load balancer não deve rotear tráfego.',
    schema: HEALTH_READY_ERROR_SCHEMA,
  })
  async ready() {
    try {
      await this.db.execute(sql`SELECT 1`);
      return {
        status: 'ok',
        checks: { database: 'ok' },
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        checks: { database: 'error' },
        timestamp: new Date().toISOString(),
      });
    }
  }
}
