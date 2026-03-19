import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ConflictError,
  DomainError,
  IdempotencyConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../domain/errors';
import { RequestContext } from '../http/request-context';

function domainErrorToHttpStatus(error: DomainError): number {
  if (error instanceof NotFoundError) return HttpStatus.NOT_FOUND;
  if (error instanceof IdempotencyConflictError) return HttpStatus.CONFLICT;
  if (error instanceof ConflictError) return HttpStatus.CONFLICT;
  if (error instanceof UnauthorizedError) return HttpStatus.UNAUTHORIZED;
  if (error instanceof ValidationError) return HttpStatus.UNPROCESSABLE_ENTITY;
  return HttpStatus.INTERNAL_SERVER_ERROR;
}

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const logContext = {
      ...RequestContext.snapshot(),
      method: request.method,
      path: request.url,
    };

    if (exception instanceof HttpException) {
      const status = exception.getStatus();

      if (status >= 500) {
        this.logger.error({
          event: 'http_exception',
          ...logContext,
          statusCode: status,
          error: exception.message,
          stack: exception.stack,
        });
      }

      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    if (exception instanceof DomainError) {
      const status = domainErrorToHttpStatus(exception);

      this.logger.error({
        event: 'domain_exception',
        ...logContext,
        statusCode: status,
        code: exception.code,
        error: exception.message,
        stack: exception.stack,
      });

      response.status(status).json({ message: exception.message, code: exception.code });
      return;
    }

    this.logger.error({
      event: 'unhandled_exception',
      ...logContext,
      error: exception instanceof Error ? exception.message : 'Unknown error',
      stack: exception instanceof Error ? exception.stack : undefined,
    });

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      message: 'Internal server error',
    });
  }
}
