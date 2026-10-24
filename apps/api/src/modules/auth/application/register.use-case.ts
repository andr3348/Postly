import { Inject, Injectable } from '@nestjs/common';
import { EmailAlreadyTakenError } from '../../../shared/errors.js';
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

export interface RegisterInput {
  readonly email: string;
  readonly name: string;
  readonly password: string;
  readonly userAgent: string | null;
  readonly ip: string | null;
}

/** Registra un usuario MARKETING y crea su primera sesión. */
@Injectable()
export class RegisterUseCase {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(SESSION_ISSUER) private readonly sessions: SessionIssuer,
  ) {}

  async execute(input: RegisterInput): Promise<AuthResult> {
    const existing = await this.users.findByEmail(input.email);
    if (existing !== null) throw new EmailAlreadyTakenError(input.email);

    const passwordHash = await this.hasher.hash(input.password);
    const user = await this.users.create({
      email: input.email,
      name: input.name,
      passwordHash,
    });
    return this.sessions.issue(user, {
      // Sin "Mantener sesión activa" en el registro: cookie de sesión.
      persistent: false,
      userAgent: input.userAgent,
      ip: input.ip,
    });
  }
}
