import type { ArgumentsHost } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';
import { DomainExceptionFilter } from './domain-exception.filter';
import {
  ConflictError,
  IdempotencyConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  DomainError,
} from '../../domain/errors';

function makeHost(responseMock: { status: jest.Mock; json: jest.Mock }): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method: 'GET', url: '/test' }),
      getResponse: () => ({
        status: (code: number) => {
          responseMock.status(code);
          return { json: responseMock.json };
        },
      }),
    }),
  } as unknown as ArgumentsHost;
}

describe('DomainExceptionFilter', () => {
  let filter: DomainExceptionFilter;
  let responseMock: { status: jest.Mock; json: jest.Mock };
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new DomainExceptionFilter();
    responseMock = { status: jest.fn(), json: jest.fn() };
    host = makeHost(responseMock);
  });

  it('should handle HttpException and return its status/response', () => {
    const exception = new HttpException({ message: 'Bad Request' }, HttpStatus.BAD_REQUEST);

    filter.catch(exception, host);

    expect(responseMock.status).toHaveBeenCalledWith(400);
    expect(responseMock.json).toHaveBeenCalledWith({ message: 'Bad Request' });
  });

  it('should handle NotFoundError with 404', () => {
    filter.catch(new NotFoundError('Not found'), host);

    expect(responseMock.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(responseMock.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'NOT_FOUND' }),
    );
  });

  it('should handle ConflictError with 409', () => {
    filter.catch(new ConflictError('Conflict'), host);

    expect(responseMock.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
  });

  it('should handle IdempotencyConflictError with 409', () => {
    filter.catch(new IdempotencyConflictError(), host);

    expect(responseMock.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(responseMock.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'IDEMPOTENCY_CONFLICT' }),
    );
  });

  it('should handle UnauthorizedError with 401', () => {
    filter.catch(new UnauthorizedError('Unauthorized'), host);

    expect(responseMock.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
  });

  it('should handle ValidationError with 422', () => {
    filter.catch(new ValidationError('Invalid input'), host);

    expect(responseMock.status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
  });

  it('should handle unknown DomainError with 500', () => {
    class UnknownDomainError extends DomainError {
      constructor() {
        super('Unknown', 'UNKNOWN');
      }
    }

    filter.catch(new UnknownDomainError(), host);

    expect(responseMock.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('should handle generic Error (non-domain) with 500', () => {
    filter.catch(new Error('Something exploded'), host);

    expect(responseMock.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(responseMock.json).toHaveBeenCalledWith({ message: 'Internal server error' });
  });

  it('should handle null/undefined exception with 500', () => {
    filter.catch(null, host);

    expect(responseMock.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});
