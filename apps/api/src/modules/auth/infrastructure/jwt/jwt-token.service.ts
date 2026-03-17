import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../../config/env';
import type {
  AuthToken,
  ITokenService,
  TokenPayload,
} from '../../application/ports/token-service.port';

@Injectable()
export class JwtTokenService implements ITokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  sign(payload: TokenPayload): AuthToken {
    const expiresIn = this.config.getOrThrow('JWT_EXPIRES_IN');
    const accessToken = this.jwtService.sign(payload, { expiresIn });
    return { accessToken, expiresIn };
  }

  verify(token: string): TokenPayload {
    return this.jwtService.verify<TokenPayload>(token);
  }
}
