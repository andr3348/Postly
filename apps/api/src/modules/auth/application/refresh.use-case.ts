import { Inject, Injectable } from '@nestjs/common';
import { InvalidRefreshTokenError } from '../../../shared/errors.js';
import type { AuthResult } from '../domain/auth-session.entity.js';
import {
  AUTH_SESSIONS_REPOSITORY,
  type AuthSessionsRepository,
} from '../domain/ports/auth-sessions.repository.js';
import {
  REFRESH_TOKEN_SERVICE,
  type RefreshTokenService,
} from '../domain/ports/refresh-token.service.js';
import { TOKEN_ISSUER, type TokenIssuer } from '../domain/ports/token-issuer.port.js';
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../domain/ports/users.repository.js';
import { toSafeUser } from '../domain/user.entity.js';

export interface RefreshInput {
  readonly refreshToken: string;
}

/**
 * Rota el refresh opaco de una sesión existente.
 * - Token válido: consume el actual, crea el siguiente y emite un access JWT.
 * - Token ya consumido: posible robo; el repositorio revoca la sesión.
 * - Token inválido/vencido: 401 (no se crea una sesión nueva).
 */
@Injectable()
export class RefreshUseCase {
  constructor(
    @Inject(AUTH_SESSIONS_REPOSITORY)
    private readonly sessions: AuthSessionsRepository,
    @Inject(REFRESH_TOKEN_SERVICE)
    private readonly refreshTokens: RefreshTokenService,
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
    @Inject(TOKEN_ISSUER) private readonly issuer: TokenIssuer,
  ) {}

  async execute(input: RefreshInput): Promise<AuthResult> {
    const now = new Date();
    const next = this.refreshTokens.issue();
    const rotated = await this.sessions.rotate({
      currentTokenHash: this.refreshTokens.hash(input.refreshToken),
      nextTokenHash: next.hash,
      nextTokenExpiresAt: next.expiresAt,
      now,
    });
    if (rotated.status !== 'ROTATED') {
      throw new InvalidRefreshTokenError();
    }

    const user = await this.users.findById(rotated.session.userId);
    if (user === null) {
      throw new InvalidRefreshTokenError();
    }
    const accessToken = await this.issuer.issueAccessToken(
      user,
      rotated.session.id,
    );
    return {
      user: toSafeUser(user),
      tokens: { accessToken, refreshToken: next.token },
      session: {
        id: rotated.session.id,
        persistent: rotated.session.persistent,
      },
    };
  }
}
