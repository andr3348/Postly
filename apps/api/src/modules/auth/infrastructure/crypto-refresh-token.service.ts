import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type {
  GeneratedRefreshToken,
  RefreshTokenService,
} from '../domain/ports/refresh-token.service.js';
import { AUTH_JWT_OPTIONS, type AuthJwtOptions } from './auth-jwt.options.js';

const TOKEN_BYTES = 48;

/**
 * Refresh tokens opacos: 48 bytes aleatorios (base64url) y SHA-256 en BD.
 * Al ser valores de alta entropía, el hash es suficiente para lookup; no
 * hace falta comparación en tiempo constante porque nunca se compara el
 * token en claro.
 */
@Injectable()
export class CryptoRefreshTokenService implements RefreshTokenService {
  constructor(
    @Inject(AUTH_JWT_OPTIONS) private readonly options: AuthJwtOptions,
  ) {}

  issue(): GeneratedRefreshToken {
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    return {
      token,
      hash: this.hash(token),
      expiresAt: new Date(
        Date.now() + this.options.refreshExpiresInSeconds * 1000,
      ),
    };
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
