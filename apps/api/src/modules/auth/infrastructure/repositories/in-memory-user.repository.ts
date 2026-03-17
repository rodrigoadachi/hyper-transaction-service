import { Injectable } from '@nestjs/common';
import type { IUserRepository } from '../../application/ports/user-repository.port';
import type { UserEntity } from '../../domain/entities/user.entity';
import type { EmailVO } from '../../domain/value-objects/email.vo';

@Injectable()
export class InMemoryUserRepository implements IUserRepository {
  private readonly store = new Map<string, UserEntity>();

  async findByEmail(email: EmailVO): Promise<UserEntity | null> {
    return this.store.get(email.value) ?? null;
  }

  async save(user: UserEntity): Promise<void> {
    this.store.set(user.email.value, user);
  }

  async existsByEmail(email: EmailVO): Promise<boolean> {
    return this.store.has(email.value);
  }
}
