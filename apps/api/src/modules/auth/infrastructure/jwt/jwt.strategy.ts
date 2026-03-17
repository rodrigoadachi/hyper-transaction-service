import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Env } from '../../../../config/env';
import type { TokenPayload } from '../../application/ports/token-service.port';

// ES256 (ECDSA P-256) — cast needed because @types/jsonwebtoken@9.0.10
const ES256: any = 'ES256';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService<Env, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: atob(config.getOrThrow('JWT_PUBLIC_KEY')),
      algorithms: [ES256],
    });
  }

  validate(payload: TokenPayload): TokenPayload {
    return payload;
  }
}
