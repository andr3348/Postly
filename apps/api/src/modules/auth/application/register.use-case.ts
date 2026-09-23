import { Inject, Injectable } from '@nestjs/common';
import { EmailAlreadyTakenError } from '../../../shared/errors.js';
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

export interface RegisterInput {
  readonly email: string;
  readonly name: string;
  readonly password: string;
}

export interface RegisterOutput {
  readonly user: SafeUser;
  readonly tokens: AuthTokens;
}

/** Registra un usuario con rol MARKETING y emite su primer par de tokens. */
@Injectable()
export class RegisterUseCase {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(TOKEN_ISSUER) private readonly issuer: TokenIssuer,
  ) {}

  async execute(input: RegisterInput): Promise<RegisterOutput> {
    const existing = await this.users.findByEmail(input.email);
    if (!existing) throw new EmailAlreadyTakenError(input.email);

    const passwordHash = await this.hasher.hash(input.password);
    const user = await this.users.create({
      email: input.email,
      name: input.name,
      passwordHash,
    });
    const tokens = await this.issuer.issuePair(user);
    return { user: toSafeUser(user), tokens };
  }
}
