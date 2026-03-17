import type { UserEntity } from '../../domain/entities/user.entity';
import type { EmailVO } from '../../domain/value-objects/email.vo';

export interface IUserRepository {
  findByEmail(email: EmailVO): Promise<UserEntity | null>;
  save(user: UserEntity): Promise<void>;
  existsByEmail(email: EmailVO): Promise<boolean>;
}
