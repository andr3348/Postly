import { Inject, Injectable } from '@nestjs/common';
import { InvalidRefreshTokenError } from '../../../shared/errors.js';
import { toSafeUser, type SafeUser } from '../domain/user.entity.js';
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../domain/ports/users.repository.js';
import {
  TOKEN_ISSUER,
  type AuthTokens,
  type TokenIssuer,
} from '../domain/ports/token-issuer.port.js';

export interface RefreshInput {
  readonly refreshToken: string;
}

export interface RefreshOutput {
  readonly user: SafeUser;
  readonly tokens: AuthTokens;
}

/**
 * Rota el par de tokens a partir de un refresh token válido.
 * Stateless: solo firma + expiración, sin persistencia ni revocación.
 */
@Injectable()
export class RefreshUseCase {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
    @Inject(TOKEN_ISSUER) private readonly issuer: TokenIssuer,
  ) {}

  async execute(input: RefreshInput): Promise<RefreshOutput> {
    const payload = await this.issuer.verifyRefreshToken(input.refreshToken);
    if (!payload) throw new InvalidRefreshTokenError();

    const user = await this.users.findById(payload.userId);
    if (!user) throw new InvalidRefreshTokenError();

    const tokens = await this.issuer.issuePair(user);
    return { user: toSafeUser(user), tokens };
  }
}
