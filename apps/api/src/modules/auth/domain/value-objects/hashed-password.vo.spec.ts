import { HashedPasswordVO } from './hashed-password.vo';

describe('HashedPasswordVO', () => {
  describe('fromHash()', () => {
    it('should create from a valid hash', () => {
      const vo = HashedPasswordVO.fromHash('$2b$12$hashed');
      expect(vo.toString()).toBe('$2b$12$hashed');
    });

    it('should throw when hash is empty string', () => {
      expect(() => HashedPasswordVO.fromHash('')).toThrow('Hash cannot be empty');
    });
  });
});
