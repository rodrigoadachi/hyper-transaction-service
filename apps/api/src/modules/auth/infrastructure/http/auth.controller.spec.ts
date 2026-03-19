import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { ConflictError, UnauthorizedError } from '../../../../shared/domain/errors';
import type { RegisterUseCase } from '../../application/use-cases/register.use-case';
import type { LoginUseCase } from '../../application/use-cases/login.use-case';

const makeRegisterUseCase = (): jest.Mocked<RegisterUseCase> =>
  ({ execute: jest.fn() }) as unknown as jest.Mocked<RegisterUseCase>;

const makeLoginUseCase = (): jest.Mocked<LoginUseCase> =>
  ({ execute: jest.fn() }) as unknown as jest.Mocked<LoginUseCase>;

describe('AuthController', () => {
  let controller: AuthController;
  let registerUseCase: jest.Mocked<RegisterUseCase>;
  let loginUseCase: jest.Mocked<LoginUseCase>;

  beforeEach(() => {
    registerUseCase = makeRegisterUseCase();
    loginUseCase = makeLoginUseCase();
    controller = new AuthController(registerUseCase, loginUseCase);
  });

  describe('register', () => {
    const dto = { email: 'user@example.com', password: 'StrongPass1' };

    it('should return data on successful registration', async () => {
      const output = { userId: 'uuid-123', email: 'user@example.com' };
      registerUseCase.execute.mockResolvedValue(output);

      const result = await controller.register(dto);

      expect(result).toEqual({ data: output });
    });

    it('should throw ConflictException when email is already in use', async () => {
      registerUseCase.execute.mockRejectedValue(new ConflictError('Email already in use'));

      await expect(controller.register(dto)).rejects.toBeInstanceOf(ConflictException);
    });

    it('should rethrow unknown errors', async () => {
      const unexpected = new Error('unexpected');
      registerUseCase.execute.mockRejectedValue(unexpected);

      await expect(controller.register(dto)).rejects.toBe(unexpected);
    });
  });

  describe('login', () => {
    const dto = { email: 'user@example.com', password: 'StrongPass1' };

    it('should return data on successful login', async () => {
      const output = { accessToken: 'jwt-token', expiresIn: '15m' };
      loginUseCase.execute.mockResolvedValue(output);

      const result = await controller.login(dto);

      expect(result).toEqual({ data: output });
    });

    it('should throw UnauthorizedException on invalid credentials', async () => {
      loginUseCase.execute.mockRejectedValue(new UnauthorizedError('Invalid credentials'));

      await expect(controller.login(dto)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('should rethrow unknown errors', async () => {
      const unexpected = new Error('unexpected');
      loginUseCase.execute.mockRejectedValue(unexpected);

      await expect(controller.login(dto)).rejects.toBe(unexpected);
    });
  });
});
