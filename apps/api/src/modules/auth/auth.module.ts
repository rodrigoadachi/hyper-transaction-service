import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { Env } from '../../config/env';
import { AUTH_TOKENS } from './auth.tokens';
import { RegisterUseCase } from './application/use-cases/register.use-case';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { BcryptPepperHasher } from './infrastructure/crypto/bcrypt-pepper.hasher';
import { JwtTokenService } from './infrastructure/jwt/jwt-token.service';
import { JwtStrategy } from './infrastructure/jwt/jwt.strategy';
import { DrizzleUserRepository } from './infrastructure/repositories/drizzle-user.repository';
import { AuthController } from './infrastructure/http/auth.controller';
import { RegistrationGuard } from './infrastructure/guards/registration.guard';

const ES256 = 'ES256' as const;

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): JwtModuleOptions => ({
        // ES256 (ECDSA P-256): asymmetric, fast, industry standard for JWT in 2026
        privateKey: atob(config.getOrThrow('JWT_PRIVATE_KEY')),
        publicKey: atob(config.getOrThrow('JWT_PUBLIC_KEY')),
        signOptions: {
          algorithm: ES256,
          expiresIn: config.getOrThrow('JWT_EXPIRES_IN'),
        },
      }),
    }),
  ],
  providers: [
    RegisterUseCase,
    LoginUseCase,
    JwtStrategy,
    RegistrationGuard,
    { provide: AUTH_TOKENS.USER_REPOSITORY, useClass: DrizzleUserRepository },
    { provide: AUTH_TOKENS.PASSWORD_HASHER, useClass: BcryptPepperHasher },
    { provide: AUTH_TOKENS.TOKEN_SERVICE, useClass: JwtTokenService },
  ],
  controllers: [AuthController],
})

export class AuthModule {}
