import { Inject, Injectable } from '@nestjs/common';
import { AUTH_TOKENS } from '../../auth.tokens';
import { EmailVO } from '../../domain/value-objects/email.vo';
import { HashedPasswordVO } from '../../domain/value-objects/hashed-password.vo';
import { UserEntity } from '../../domain/entities/user.entity';
import { ConflictError } from '../../../../shared/domain/errors';
import type { IUserRepository } from '../ports/user-repository.port';
import type { IPasswordHasher } from '../ports/password-hasher.port';

export interface RegisterInput {
  readonly email: string;
  readonly password: string;
}

export interface RegisterOutput {
  readonly userId: string;
  readonly email: string;
}

@Injectable()
export class RegisterUseCase {
  constructor(
    @Inject(AUTH_TOKENS.USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(AUTH_TOKENS.PASSWORD_HASHER)
    private readonly passwordHasher: IPasswordHasher,
  ) {}

  async execute(input: RegisterInput): Promise<RegisterOutput> {
    const email = EmailVO.create(input.email);

    if (await this.userRepository.existsByEmail(email)) throw new ConflictError('Email already registered');

    const hash = await this.passwordHasher.hash(input.password);
    const hashedPassword = HashedPasswordVO.fromHash(hash);
    const user = UserEntity.create(email, hashedPassword);

    await this.userRepository.save(user);

    return { userId: user.id.toString(), email: user.email.toString() };
  }
}
