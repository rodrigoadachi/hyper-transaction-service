import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ConflictError,
  DomainError,
  IdempotencyConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../domain/errors';

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
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    if (exception instanceof DomainError) {
      const status = domainErrorToHttpStatus(exception);

      if (status >= 500) {
        this.logger.error({ event: 'unhandled_domain_error', code: exception.code, message: exception.message });
      }

      response.status(status).json({ message: exception.message, code: exception.code });
      return;
    }

    this.logger.error({ event: 'unhandled_exception', message: (exception as Error)?.message ?? 'Unknown error' });

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      message: 'Internal server error',
    });
  }
}
