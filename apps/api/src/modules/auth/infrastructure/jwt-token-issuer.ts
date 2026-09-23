import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { UserRole } from '../domain/user.entity.js';
import type {
  AccessPayload,
  AuthTokens,
  TokenIssuer,
} from '../domain/ports/token-issuer.port.js';
import { AUTH_JWT_OPTIONS, type AuthJwtOptions } from './auth-jwt.options.js';

const REFRESH_TOKEN_TYPE = 'refresh';

interface AccessJwtPayload {
  readonly sub: string;
  readonly email: string;
  readonly role: UserRole;
}

interface RefreshJwtPayload {
  readonly sub: string;
  readonly type: string;
}

/**
 * Adaptador JWT de `TokenIssuer` (firma HMAC, stateless).
 * Access corto + refresh largo con secretos distintos; el campo `type`
 * impide usar un access token donde se espera un refresh token.
 */
@Injectable()
export class JwtTokenIssuer implements TokenIssuer {
  constructor(
    private readonly jwt: JwtService,
    @Inject(AUTH_JWT_OPTIONS) private readonly options: AuthJwtOptions,
  ) {}

  async issuePair(user: {
    id: string;
    email: string;
    role: UserRole;
  }): Promise<AuthTokens> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        { sub: user.id, email: user.email, role: user.role },
        {
          secret: this.options.accessSecret,
          expiresIn: this.options.accessExpiresInSeconds,
        },
      ),
      this.jwt.signAsync(
        { sub: user.id, type: REFRESH_TOKEN_TYPE },
        {
          secret: this.options.refreshSecret,
          expiresIn: this.options.refreshExpiresInSeconds,
        },
      ),
    ]);
    return { accessToken, refreshToken };
  }

  async verifyAccessToken(token: string): Promise<AccessPayload | null> {
    try {
      const payload = await this.jwt.verifyAsync<AccessJwtPayload>(token, {
        secret: this.options.accessSecret,
      });
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.email !== 'string'
      ) {
        return null;
      }
      if (payload.role !== 'ADMIN' && payload.role !== 'MARKETING') {
        return null;
      }
      return { userId: payload.sub, email: payload.email, role: payload.role };
    } catch {
      return null;
    }
  }

  async verifyRefreshToken(token: string): Promise<{ userId: string } | null> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshJwtPayload>(token, {
        secret: this.options.refreshSecret,
      });
      if (
        payload.type !== REFRESH_TOKEN_TYPE ||
        typeof payload.sub !== 'string'
      ) {
        return null;
      }
      return { userId: payload.sub };
    } catch {
      return null;
    }
  }
}
