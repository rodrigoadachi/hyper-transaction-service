export class HashedPasswordVO {
  private constructor(readonly value: string) {}

  static fromHash(hash: string): HashedPasswordVO {
    if (!hash || hash.length === 0) throw new Error('Hash cannot be empty');
    return new HashedPasswordVO(hash);
  }

  toString(): string {
    return this.value;
  }
}
