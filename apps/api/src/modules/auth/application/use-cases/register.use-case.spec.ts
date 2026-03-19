import { RegisterUseCase } from './register.use-case';
import { ConflictError } from '../../../../shared/domain/errors';
import type { IUserRepository } from '../ports/user-repository.port';
import type { IPasswordHasher } from '../ports/password-hasher.port';

const makeUserRepository = (): jest.Mocked<IUserRepository> => ({
  findByEmail: jest.fn(),
  save: jest.fn(),
  existsByEmail: jest.fn(),
});

const makePasswordHasher = (): jest.Mocked<IPasswordHasher> => ({
  hash: jest.fn(),
  verify: jest.fn(),
});

describe('RegisterUseCase', () => {
  let useCase: RegisterUseCase;
  let userRepository: jest.Mocked<IUserRepository>;
  let passwordHasher: jest.Mocked<IPasswordHasher>;

  beforeEach(() => {
    userRepository = makeUserRepository();
    passwordHasher = makePasswordHasher();
    useCase = new RegisterUseCase(userRepository as IUserRepository, passwordHasher as IPasswordHasher);
  });

  it('should register a new user successfully', async () => {
    userRepository.existsByEmail.mockResolvedValue(false);
    passwordHasher.hash.mockResolvedValue('$2b$12$hashedpassword');
    userRepository.save.mockResolvedValue();

    const output = await useCase.execute({ email: 'user@example.com', password: 'Password1' });

    expect(output.email).toBe('user@example.com');
    expect(typeof output.userId).toBe('string');
    expect(userRepository.save).toHaveBeenCalledTimes(1);
  });

  it('should throw ConflictError when email already exists', async () => {
    userRepository.existsByEmail.mockResolvedValue(true);

    await expect(useCase.execute({ email: 'user@example.com', password: 'Password1' })).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('should throw when email is invalid', async () => {
    await expect(useCase.execute({ email: 'not-an-email', password: 'Password1' })).rejects.toThrow();
  });

  it('should pass hashed password to repository (not plaintext)', async () => {
    userRepository.existsByEmail.mockResolvedValue(false);
    passwordHasher.hash.mockResolvedValue('$hashed');
    userRepository.save.mockResolvedValue();

    await useCase.execute({ email: 'user@example.com', password: 'Password1' });

    const savedUser = userRepository.save.mock.calls[0][0];
    expect(savedUser.hashedPassword.toString()).toBe('$hashed');
    expect(savedUser.hashedPassword.toString()).not.toBe('Password1');
  });
});
