import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import type { Env } from '../../../../config/env';
import type { IPasswordHasher } from '../../application/ports/password-hasher.port';

@Injectable()
export class BcryptPepperHasher implements IPasswordHasher {
  private readonly pepper: string;
  private readonly rounds: number;

  constructor(config: ConfigService<Env, true>) {
    this.pepper = config.getOrThrow('PEPPER');
    this.rounds = config.getOrThrow('BCRYPT_ROUNDS');
  }

  async hash(plainText: string): Promise<string> {
    return bcrypt.hash(plainText + this.pepper, this.rounds);
  }

  async verify(plainText: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plainText + this.pepper, hash);
  }
}
