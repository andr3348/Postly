import { Inject, Injectable } from '@nestjs/common';
import type { AuthResult } from '../domain/auth-session.entity.js';
import {
  AUTH_SESSIONS_REPOSITORY,
  type AuthSessionsRepository,
} from '../domain/ports/auth-sessions.repository.js';
import {
  REFRESH_TOKEN_SERVICE,
  type RefreshTokenService,
} from '../domain/ports/refresh-token.service.js';
import type {
  SessionContext,
  SessionIssuer,
} from '../domain/ports/session-issuer.port.js';
import { TOKEN_ISSUER, type TokenIssuer } from '../domain/ports/token-issuer.port.js';
import { toSafeUser, type User } from '../domain/user.entity.js';

/**
 * Crea una sesión nueva (login/registro) y emite el par:
 * access JWT corto + refresh opaco. El refresh en claro solo se devuelve
 * al controller para la cookie; en BD queda su hash.
 */
@Injectable()
export class AuthSessionIssuer implements SessionIssuer {
  constructor(
    @Inject(AUTH_SESSIONS_REPOSITORY)
    private readonly sessions: AuthSessionsRepository,
    @Inject(REFRESH_TOKEN_SERVICE)
    private readonly refreshTokens: RefreshTokenService,
    @Inject(TOKEN_ISSUER) private readonly issuer: TokenIssuer,
  ) {}

  async issue(user: User, context: SessionContext): Promise<AuthResult> {
    const now = new Date();
    await this.sessions.deleteExpiredForUser(user.id, now);

    const refresh = this.refreshTokens.issue();
    const session = await this.sessions.create({
      userId: user.id,
      persistent: context.persistent,
      userAgent: context.userAgent,
      ip: context.ip,
      tokenHash: refresh.hash,
      tokenExpiresAt: refresh.expiresAt,
      sessionExpiresAt: refresh.expiresAt,
      now,
    });
    const accessToken = await this.issuer.issueAccessToken(user, session.id);

    return {
      user: toSafeUser(user),
      tokens: { accessToken, refreshToken: refresh.token },
      session: { id: session.id, persistent: session.persistent },
    };
  }
}
