const CURRENCY_REGEX = /^[A-Z]{3}$/;
const MAX_AMOUNT_CENTS = 9_999_999_999; // ~99.9 million in the base unit

export class MoneyVO {
  private constructor(
    readonly amountInCents: number,
    readonly currency: string,
  ) {}

  static of(amountInCents: number, currency: string): MoneyVO {
    if (!Number.isInteger(amountInCents) || amountInCents <= 0) {
      throw new Error('Amount must be a positive integer representing cents');
    }
    if (amountInCents > MAX_AMOUNT_CENTS) {
      throw new Error(`Amount exceeds maximum allowed value of ${MAX_AMOUNT_CENTS} cents`);
    }
    const normalizedCurrency = currency.trim().toUpperCase();
    if (!CURRENCY_REGEX.test(normalizedCurrency)) {
      throw new Error(`Invalid currency code "${currency}". Must be a 3-letter ISO 4217 code (e.g. BRL, USD)`);
    }
    return new MoneyVO(amountInCents, normalizedCurrency);
  }

  toString(): string {
    return `${this.amountInCents} ${this.currency}`;
  }
}
