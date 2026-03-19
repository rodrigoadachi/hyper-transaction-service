import { MoneyVO } from './money.vo';

describe('MoneyVO', () => {
  describe('of()', () => {
    it('should create a valid MoneyVO', () => {
      const money = MoneyVO.of(15000, 'BRL');
      expect(money.amountInCents).toBe(15000);
      expect(money.currency).toBe('BRL');
    });

    it('should normalize currency to uppercase', () => {
      const money = MoneyVO.of(100, 'brl');
      expect(money.currency).toBe('BRL');
    });

    it('should trim whitespace from currency', () => {
      const money = MoneyVO.of(100, '  USD  ');
      expect(money.currency).toBe('USD');
    });

    it('should throw when amount is zero', () => {
      expect(() => MoneyVO.of(0, 'BRL')).toThrow('positive integer');
    });

    it('should throw when amount is negative', () => {
      expect(() => MoneyVO.of(-100, 'BRL')).toThrow('positive integer');
    });

    it('should throw when amount is not an integer', () => {
      expect(() => MoneyVO.of(1.5, 'BRL')).toThrow('positive integer');
    });

    it('should throw when amount exceeds maximum', () => {
      expect(() => MoneyVO.of(10_000_000_000, 'BRL')).toThrow('maximum');
    });

    it('should accept the maximum allowed value', () => {
      const money = MoneyVO.of(9_999_999_999, 'BRL');
      expect(money.amountInCents).toBe(9_999_999_999);
    });

    it('should throw for invalid currency code (numeric)', () => {
      expect(() => MoneyVO.of(100, '123')).toThrow('ISO 4217');
    });

    it('should throw for currency with wrong length', () => {
      expect(() => MoneyVO.of(100, 'BR')).toThrow('ISO 4217');
    });

    it('should throw for currency with more than 3 letters', () => {
      expect(() => MoneyVO.of(100, 'BRRL')).toThrow('ISO 4217');
    });
  });

  describe('toString()', () => {
    it('should return amount and currency', () => {
      const money = MoneyVO.of(15000, 'BRL');
      expect(money.toString()).toBe('15000 BRL');
    });
  });
});
