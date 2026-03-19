import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { RequestContext } from './request-context';

interface AuthenticatedRequest extends Request {
  user?: {
    sub?: string;
  };
}

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CorrelationIdInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const response = http.getResponse<Response>();
    const correlationIdHeader = request.headers['x-correlation-id'];
    const correlationId =
      typeof correlationIdHeader === 'string' && correlationIdHeader.trim().length > 0
        ? correlationIdHeader.trim()
        : randomUUID();
    const idempotencyHeader = request.headers['x-idempotency-key'];
    const startedAt = Date.now();

    response.setHeader('x-correlation-id', correlationId);

    return RequestContext.run(
      {
        correlationId,
        tenantId: request.user?.sub,
        idempotencyKey: typeof idempotencyHeader === 'string' ? idempotencyHeader : undefined,
        method: request.method,
        path: request.originalUrl ?? request.url,
      },
      () => {
        this.logger.log({
          event: 'http.request.started',
          correlationId,
          tenantId: request.user?.sub,
          idempotencyKey: typeof idempotencyHeader === 'string' ? idempotencyHeader : undefined,
          method: request.method,
          path: request.originalUrl ?? request.url,
        });

        return next.handle().pipe(
          finalize(() => {
            const snapshot = RequestContext.snapshot();
            this.logger.log({
              event: 'http.request.completed',
              correlationId,
              tenantId: snapshot.tenantId,
              idempotencyKey: snapshot.idempotencyKey,
              transactionId: snapshot.transactionId,
              method: request.method,
              path: request.originalUrl ?? request.url,
              statusCode: response.statusCode,
              durationMs: Date.now() - startedAt,
            });
          }),
        );
      },
    );
  }
}