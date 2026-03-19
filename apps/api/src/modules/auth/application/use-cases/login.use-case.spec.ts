import { LoginUseCase } from './login.use-case';
import { UnauthorizedError } from '../../../../shared/domain/errors';
import { UserEntity } from '../../domain/entities/user.entity';
import { EmailVO } from '../../domain/value-objects/email.vo';
import { HashedPasswordVO } from '../../domain/value-objects/hashed-password.vo';
import { UuidVO } from '../../../../shared/domain/value-objects/uuid.vo';
import type { IUserRepository } from '../ports/user-repository.port';
import type { IPasswordHasher } from '../ports/password-hasher.port';
import type { ITokenService } from '../ports/token-service.port';

const stubUser = UserEntity.reconstitute(
  UuidVO.fromString('01945cf0-0000-7000-8000-000000000001'),
  EmailVO.create('user@example.com'),
  HashedPasswordVO.fromHash('$2b$12$hashed'),
  new Date(),
);

const makeUserRepository = (): jest.Mocked<IUserRepository> => ({
  findByEmail: jest.fn(),
  save: jest.fn(),
  existsByEmail: jest.fn(),
});

const makePasswordHasher = (): jest.Mocked<IPasswordHasher> => ({
  hash: jest.fn(),
  verify: jest.fn(),
});

const makeTokenService = (): jest.Mocked<ITokenService> => ({
  sign: jest.fn(),
  verify: jest.fn(),
});

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;
  let userRepository: jest.Mocked<IUserRepository>;
  let passwordHasher: jest.Mocked<IPasswordHasher>;
  let tokenService: jest.Mocked<ITokenService>;

  beforeEach(() => {
    userRepository = makeUserRepository();
    passwordHasher = makePasswordHasher();
    tokenService = makeTokenService();
    useCase = new LoginUseCase(
      userRepository as IUserRepository,
      passwordHasher as IPasswordHasher,
      tokenService as ITokenService,
    );
  });

  it('should return an access token on valid credentials', async () => {
    userRepository.findByEmail.mockResolvedValue(stubUser);
    passwordHasher.verify.mockResolvedValue(true);
    tokenService.sign.mockReturnValue({ accessToken: 'jwt-token', expiresIn: '1h' });

    const output = await useCase.execute({ email: 'user@example.com', password: 'Password1' });

    expect(output.accessToken).toBe('jwt-token');
    expect(output.expiresIn).toBe('1h');
  });

  it('should throw UnauthorizedError when user not found', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    passwordHasher.verify.mockResolvedValue(false);

    await expect(useCase.execute({ email: 'unknown@example.com', password: 'any' })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('should throw UnauthorizedError when password is wrong', async () => {
    userRepository.findByEmail.mockResolvedValue(stubUser);
    passwordHasher.verify.mockResolvedValue(false);

    await expect(useCase.execute({ email: 'user@example.com', password: 'WrongPass' })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('should still call verify even when user is not found (timing-safe)', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    passwordHasher.verify.mockResolvedValue(false);

    await expect(useCase.execute({ email: 'ghost@example.com', password: 'any' })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );

    // verify should be called with the dummy hash — not short-circuited
    expect(passwordHasher.verify).toHaveBeenCalledTimes(1);
  });
});
