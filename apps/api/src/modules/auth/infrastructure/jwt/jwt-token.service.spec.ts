import { JwtTokenService } from './jwt-token.service';
import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import type { TokenPayload } from '../../application/ports/token-service.port';

function makeJwtService(): jest.Mocked<JwtService> {
  return {
    sign: jest.fn(),
    verify: jest.fn(),
  } as unknown as jest.Mocked<JwtService>;
}

function makeConfig(expiresIn = '15m'): jest.Mocked<ConfigService> {
  return {
    getOrThrow: jest.fn().mockReturnValue(expiresIn),
  } as unknown as jest.Mocked<ConfigService>;
}

describe('JwtTokenService', () => {
  let service: JwtTokenService;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(() => {
    jwtService = makeJwtService();
    service = new JwtTokenService(jwtService, makeConfig('15m'));
  });

  describe('sign', () => {
    it('should return an AuthToken with accessToken and expiresIn', () => {
      jwtService.sign.mockReturnValue('signed-jwt');

      const payload: TokenPayload = { sub: 'user-id', email: 'user@example.com' };
      const result = service.sign(payload);

      expect(result.accessToken).toBe('signed-jwt');
      expect(result.expiresIn).toBe('15m');
      expect(jwtService.sign).toHaveBeenCalledWith(payload, { expiresIn: '15m' });
    });
  });

  describe('verify', () => {
    it('should return the token payload on valid token', () => {
      const payload: TokenPayload = { sub: 'user-id', email: 'user@example.com' };
      jwtService.verify.mockReturnValue(payload);

      const result = service.verify('some-token');

      expect(result).toEqual(payload);
      expect(jwtService.verify).toHaveBeenCalledWith('some-token');
    });
  });
});
