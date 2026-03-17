import { Inject, Injectable } from '@nestjs/common';
import { AUTH_TOKENS } from '../../auth.tokens';
import { EmailVO } from '../../domain/value-objects/email.vo';
import { UnauthorizedError } from '../../../../shared/domain/errors';
import type { IUserRepository } from '../ports/user-repository.port';
import type { IPasswordHasher } from '../ports/password-hasher.port';
import type { ITokenService } from '../ports/token-service.port';

export interface LoginInput {
  readonly email: string;
  readonly password: string;
}

export interface LoginOutput {
  readonly accessToken: string;
  readonly expiresIn: string;
}

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(AUTH_TOKENS.USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(AUTH_TOKENS.PASSWORD_HASHER)
    private readonly passwordHasher: IPasswordHasher,
    @Inject(AUTH_TOKENS.TOKEN_SERVICE)
    private readonly tokenService: ITokenService,
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const email = EmailVO.create(input.email);
    const user = await this.userRepository.findByEmail(email);

    const dummyHash = '$2b$12$invalidhashpaddingtomaintainconstanttimeverification00000';
    const hash = user?.hashedPassword.toString() ?? dummyHash;

    const isValid = await this.passwordHasher.verify(input.password, hash);

    if (!user || !isValid) throw new UnauthorizedError('Invalid credentials');

    const token = this.tokenService.sign({
      sub: user.id.toString(),
      email: user.email.toString(),
    });

    return { accessToken: token.accessToken, expiresIn: token.expiresIn };
  }
}
