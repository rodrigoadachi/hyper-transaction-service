import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import type { Env } from '../../../../config/env';

/**
 * Protege o endpoint de registro com um segredo pré-compartilhado.
 *
 * O chamador deve enviar o header:
 *   X-Registration-Token: <valor de REGISTRATION_SECRET>
 *
 * A comparação usa `timingSafeEqual` para prevenir timing attacks.
 */
@Injectable()
export class RegistrationGuard implements CanActivate {
  private readonly secretBuf: Buffer;

  constructor(config: ConfigService<Env, true>) {
    const secret: string = config.getOrThrow('REGISTRATION_SECRET');
    this.secretBuf = Buffer.from(secret, 'utf8');
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.headers['x-registration-token'];

    if (typeof token !== 'string' || token.length === 0) {
      throw new UnauthorizedException('Missing X-Registration-Token header');
    }

    const tokenBuf = Buffer.from(token, 'utf8');

    // Os buffers devem ter o mesmo tamanho para timingSafeEqual não lançar erro.
    // Quando diferem, a comparação é feita contra uma cópia do secretBuf
    // de mesmo tamanho para manter tempo constante.
    const safe =
      tokenBuf.length === this.secretBuf.length &&
      timingSafeEqual(tokenBuf, this.secretBuf);

    if (!safe) {
      throw new UnauthorizedException('Invalid registration token');
    }

    return true;
  }
}
