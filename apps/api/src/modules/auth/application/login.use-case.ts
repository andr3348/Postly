import { Inject, Injectable } from '@nestjs/common';
import { InvalidCredentialsError } from '../../../shared/errors.js';
import { toSafeUser, type SafeUser } from '../domain/user.entity.js';
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../domain/ports/users.repository.js';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../domain/ports/password-hasher.port.js';
import {
  TOKEN_ISSUER,
  type AuthTokens,
  type TokenIssuer,
} from '../domain/ports/token-issuer.port.js';

export interface LoginInput {
  readonly email: string;
  readonly password: string;
}

export interface LoginOutput {
  readonly user: SafeUser;
  readonly tokens: AuthTokens;
}

/**
 * Autentica por email + password.
 * Mensaje único ante usuario inexistente o password incorrecto
 * (no revelar cuál de los dos falló).
 */
@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(TOKEN_ISSUER) private readonly issuer: TokenIssuer,
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const user = await this.users.findByEmail(input.email);
    if (!user) throw new InvalidCredentialsError();

    const valid = await this.hasher.verify(input.password, user.passwordHash);
    if (!valid) throw new InvalidCredentialsError();

    const tokens = await this.issuer.issuePair(user);
    return { user: toSafeUser(user), tokens };
  }
}
