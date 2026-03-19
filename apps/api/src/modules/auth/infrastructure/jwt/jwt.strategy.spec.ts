import { JwtStrategy } from './jwt.strategy';
import type { TokenPayload } from '../../application/ports/token-service.port';
import type { ConfigService } from '@nestjs/config';

// Generate a minimal valid base64-encoded EC P-256 public key PEM for testing
// This is a real but test-only key — not used for anything secure.
const TEST_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEd8KW9PJ3D3zxNDiXiNFAe8Gm5YFH
lGzmFnklFNxF/9yz7b6yFLy5XMMQ9nt7kFcqzmK7Iz2SDggQ7lQVSWJf+A==
-----END PUBLIC KEY-----`;

const TEST_PUBLIC_KEY_B64 = Buffer.from(TEST_PUBLIC_KEY_PEM).toString('base64');

function makeConfig(publicKeyB64 = TEST_PUBLIC_KEY_B64): jest.Mocked<ConfigService> {
  return {
    getOrThrow: jest.fn().mockReturnValue(publicKeyB64),
  } as unknown as jest.Mocked<ConfigService>;
}

describe('JwtStrategy', () => {
  it('should instantiate without throwing', () => {
    expect(() => new JwtStrategy(makeConfig())).not.toThrow();
  });

  it('should return the payload as-is from validate()', () => {
    const strategy = new JwtStrategy(makeConfig());
    const payload: TokenPayload = { sub: 'user-id', email: 'user@example.com' };

    const result = strategy.validate(payload);

    expect(result).toEqual(payload);
  });
});
