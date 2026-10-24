import { Inject, Injectable } from '@nestjs/common';
import { InvalidCredentialsError } from '../../../shared/errors.js';
import type { AuthResult } from '../domain/auth-session.entity.js';
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../domain/ports/users.repository.js';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../domain/ports/password-hasher.port.js';
import {
  SESSION_ISSUER,
  type SessionIssuer,
} from '../domain/ports/session-issuer.port.js';

export interface LoginInput {
  readonly email: string;
  readonly password: string;
  readonly rememberMe: boolean;
  readonly userAgent: string | null;
  readonly ip: string | null;
}

/**
 * Autentica por email + password y crea una sesión nueva (multi-dispositivo).
 * Mensaje único ante usuario inexistente o password incorrecto
 * (no revelar cuál de los dos falló).
 */
@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(SESSION_ISSUER) private readonly sessions: SessionIssuer,
  ) {}

  async execute(input: LoginInput): Promise<AuthResult> {
    const user = await this.users.findByEmail(input.email);
    if (!user) throw new InvalidCredentialsError();

    const valid = await this.hasher.verify(input.password, user.passwordHash);
    if (!valid) throw new InvalidCredentialsError();

    return this.sessions.issue(user, {
      persistent: input.rememberMe,
      userAgent: input.userAgent,
      ip: input.ip,
    });
  }
}
