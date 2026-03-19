import {
  ConflictError,
  DomainError,
  IdempotencyConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from './errors';

describe('DomainError hierarchy', () => {
  it('ConflictError should be a DomainError with code CONFLICT', () => {
    const e = new ConflictError('duplicate');
    expect(e).toBeInstanceOf(DomainError);
    expect(e.code).toBe('CONFLICT');
    expect(e.message).toBe('duplicate');
  });

  it('NotFoundError should have code NOT_FOUND', () => {
    const e = new NotFoundError('not found');
    expect(e.code).toBe('NOT_FOUND');
  });

  it('UnauthorizedError should have code UNAUTHORIZED', () => {
    const e = new UnauthorizedError('forbidden');
    expect(e.code).toBe('UNAUTHORIZED');
  });

  it('ValidationError should have code VALIDATION_ERROR', () => {
    const e = new ValidationError('invalid');
    expect(e.code).toBe('VALIDATION_ERROR');
  });

  it('IdempotencyConflictError should have code IDEMPOTENCY_CONFLICT', () => {
    const e = new IdempotencyConflictError();
    expect(e.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(e).toBeInstanceOf(DomainError);
  });

  it('should have correct name set to class name', () => {
    const e = new NotFoundError('x');
    expect(e.name).toBe('NotFoundError');
  });
});
