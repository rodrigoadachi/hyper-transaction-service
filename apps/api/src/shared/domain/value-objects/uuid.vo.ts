import { uuidv7 } from 'uuidv7';

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class UuidVO {
  private constructor(readonly value: string) {}

  static generate(): UuidVO {
    return new UuidVO(uuidv7());
  }

  static fromString(value: string): UuidVO {
    if (!UUID_V7_REGEX.test(value)) throw new Error(`Invalid UUIDv7: "${value}"`);
    return new UuidVO(value);
  }

  equals(other: UuidVO): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
