import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { UserRole } from '../domain/user.entity.js';
import type {
  AccessPayload,
  TokenIssuer,
} from '../domain/ports/token-issuer.port.js';
import { AUTH_JWT_OPTIONS, type AuthJwtOptions } from './auth-jwt.options.js';

interface AccessJwtPayload {
  readonly sub: string;
  readonly email: string;
  readonly role: UserRole;
  readonly sid: string;
}

/**
 * Adaptador JWT del access token (firma HMAC, corto).
 * El refresh es opaco y no pasa por este adaptador: lo emite
 * `CryptoRefreshTokenService` y se persiste hasheado.
 */
@Injectable()
export class JwtTokenIssuer implements TokenIssuer {
  constructor(
    private readonly jwt: JwtService,
    @Inject(AUTH_JWT_OPTIONS) private readonly options: AuthJwtOptions,
  ) {}

  async issueAccessToken(
    user: {
      id: string;
      email: string;
      role: UserRole;
    },
    sessionId: string,
  ): Promise<string> {
    return this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role, sid: sessionId },
      {
        secret: this.options.accessSecret,
        expiresIn: this.options.accessExpiresInSeconds,
      },
    );
  }

  async verifyAccessToken(token: string): Promise<AccessPayload | null> {
    try {
      const payload = await this.jwt.verifyAsync<AccessJwtPayload>(token, {
        secret: this.options.accessSecret,
      });
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.email !== 'string' ||
        typeof payload.sid !== 'string'
      ) {
        return null;
      }
      if (payload.role !== 'ADMIN' && payload.role !== 'MARKETING') {
        return null;
      }
      return {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
        sessionId: payload.sid,
      };
    } catch {
      return null;
    }
  }
}
