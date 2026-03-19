import { BcryptPepperHasher } from './bcrypt-pepper.hasher';
import type { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

function makeConfig(pepper = 'test-pepper', rounds = 10): jest.Mocked<ConfigService> {
  return {
    getOrThrow: jest.fn().mockImplementation((key: string) => {
      if (key === 'PEPPER') return pepper;
      if (key === 'BCRYPT_ROUNDS') return rounds;
      throw new Error(`Unexpected config key: ${key}`);
    }),
  } as unknown as jest.Mocked<ConfigService>;
}

describe('BcryptPepperHasher', () => {
  let hasher: BcryptPepperHasher;

  beforeEach(() => {
    hasher = new BcryptPepperHasher(makeConfig());
  });

  it('should hash a plain text password', async () => {
    const hash = await hasher.hash('MyPassword1');

    expect(hash).toBeDefined();
    expect(hash).not.toBe('MyPassword1');
    expect(hash.startsWith('$2')).toBe(true);
  });

  it('should verify a correct password', async () => {
    const hash = await hasher.hash('MyPassword1');
    const isValid = await hasher.verify('MyPassword1', hash);

    expect(isValid).toBe(true);
  });

  it('should reject an incorrect password', async () => {
    const hash = await hasher.hash('MyPassword1');
    const isValid = await hasher.verify('WrongPassword', hash);

    expect(isValid).toBe(false);
  });

  it('should include pepper in the hash computation', async () => {
    const hasherA = new BcryptPepperHasher(makeConfig('pepper-A'));
    const hasherB = new BcryptPepperHasher(makeConfig('pepper-B'));

    const hash = await hasherA.hash('MyPassword1');

    // verifying with different pepper should fail
    const result = await hasherB.verify('MyPassword1', hash);
    expect(result).toBe(false);
  });

  it('should produce different hashes for same input (bcrypt salt)', async () => {
    const hash1 = await hasher.hash('MyPassword1');
    const hash2 = await hasher.hash('MyPassword1');

    expect(hash1).not.toBe(hash2);
  });
});
