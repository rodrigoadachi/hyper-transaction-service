import { EmailVO } from './email.vo';

describe('EmailVO', () => {
  describe('create()', () => {
    it('should create a valid email', () => {
      const email = EmailVO.create('User@Example.com');
      expect(email.toString()).toBe('user@example.com');
    });

    it('should normalize to lowercase', () => {
      const email = EmailVO.create('ADMIN@COMPANY.COM');
      expect(email.toString()).toBe('admin@company.com');
    });

    it('should trim whitespace', () => {
      const email = EmailVO.create('  user@example.com  ');
      expect(email.toString()).toBe('user@example.com');
    });

    it('should throw on missing @ symbol', () => {
      expect(() => EmailVO.create('notanemail.com')).toThrow(/Invalid email/);
    });

    it('should throw on missing domain', () => {
      expect(() => EmailVO.create('user@')).toThrow(/Invalid email/);
    });

    it('should throw on missing TLD', () => {
      expect(() => EmailVO.create('user@domain')).toThrow(/Invalid email/);
    });

    it('should throw on empty string', () => {
      expect(() => EmailVO.create('')).toThrow(/Invalid email/);
    });
  });

  describe('equals()', () => {
    it('should return true for equal emails', () => {
      const a = EmailVO.create('user@example.com');
      const b = EmailVO.create('USER@EXAMPLE.COM');
      expect(a.equals(b)).toBe(true);
    });

    it('should return false for different emails', () => {
      const a = EmailVO.create('user1@example.com');
      const b = EmailVO.create('user2@example.com');
      expect(a.equals(b)).toBe(false);
    });
  });
});
