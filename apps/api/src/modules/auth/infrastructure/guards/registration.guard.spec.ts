import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { RegistrationGuard } from './registration.guard';
import type { ConfigService } from '@nestjs/config';

function makeConfig(secret: string): jest.Mocked<ConfigService> {
  return {
    getOrThrow: jest.fn().mockReturnValue(secret),
  } as unknown as jest.Mocked<ConfigService>;
}

function makeContext(token: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: token !== undefined ? { 'x-registration-token': token } : {},
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('RegistrationGuard', () => {
  const secret = 'my-registration-secret';

  it('should return true when token matches secret', () => {
    const guard = new RegistrationGuard(makeConfig(secret));
    const ctx = makeContext(secret);

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw UnauthorizedException when header is missing', () => {
    const guard = new RegistrationGuard(makeConfig(secret));
    const ctx = makeContext(undefined);

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when header is empty string', () => {
    const guard = new RegistrationGuard(makeConfig(secret));
    const ctx = makeContext('');

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when token does not match', () => {
    const guard = new RegistrationGuard(makeConfig(secret));
    const ctx = makeContext('wrong-token');

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when token has different length', () => {
    const guard = new RegistrationGuard(makeConfig(secret));
    const ctx = makeContext('short');

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });
});
