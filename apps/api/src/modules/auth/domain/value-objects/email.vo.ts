const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

export class EmailVO {
  private constructor(readonly value: string) {}

  static create(raw: string): EmailVO {
    const normalized = raw.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalized)) throw new Error(`Invalid email: "${raw}"`);
    return new EmailVO(normalized);
  }

  equals(other: EmailVO): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
