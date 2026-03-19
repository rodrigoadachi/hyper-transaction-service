import { UuidVO } from '../../../../shared/domain/value-objects/uuid.vo';
import type { EmailVO } from '../value-objects/email.vo';
import type { HashedPasswordVO } from '../value-objects/hashed-password.vo';

export class UserEntity {
  private constructor(
    readonly id: UuidVO,
    readonly email: EmailVO,
    readonly hashedPassword: HashedPasswordVO,
    readonly createdAt: Date,
  ) {}

  static create(email: EmailVO, hashedPassword: HashedPasswordVO): UserEntity {
    return new UserEntity(UuidVO.generate(), email, hashedPassword, new Date());
  }

  static reconstitute(
    id: UuidVO,
    email: EmailVO,
    hashedPassword: HashedPasswordVO,
    createdAt: Date,
  ): UserEntity {
    return new UserEntity(id, email, hashedPassword, createdAt);
  }
}
