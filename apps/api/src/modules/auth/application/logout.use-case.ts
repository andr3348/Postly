import { Inject, Injectable } from '@nestjs/common';
import {
  AUTH_SESSIONS_REPOSITORY,
  type AuthSessionsRepository,
} from '../domain/ports/auth-sessions.repository.js';
import {
  REFRESH_TOKEN_SERVICE,
  type RefreshTokenService,
} from '../domain/ports/refresh-token.service.js';

export interface LogoutInput {
  readonly refreshToken: string | null;
}

/**
 * Logout con revocación en servidor. Es público a propósito: debe funcionar
 * aunque el access JWT ya haya expirado. El refresh identifica la sesión.
 */
@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(AUTH_SESSIONS_REPOSITORY)
    private readonly sessions: AuthSessionsRepository,
    @Inject(REFRESH_TOKEN_SERVICE)
    private readonly refreshTokens: RefreshTokenService,
  ) {}

  async execute(input: LogoutInput): Promise<void> {
    if (input.refreshToken === null || input.refreshToken === '') {
      return;
    }
    await this.sessions.revokeByRefreshTokenHash(
      this.refreshTokens.hash(input.refreshToken),
      new Date(),
    );
  }
}
