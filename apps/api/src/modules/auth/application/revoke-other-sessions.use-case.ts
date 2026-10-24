import { Inject, Injectable } from '@nestjs/common';
import {
  AUTH_SESSIONS_REPOSITORY,
  type AuthSessionsRepository,
} from '../domain/ports/auth-sessions.repository.js';

export interface RevokeOtherSessionsInput {
  readonly userId: string;
  readonly currentSessionId: string;
}

/** Cierra todas las sesiones del usuario menos la actual. */
@Injectable()
export class RevokeOtherSessionsUseCase {
  constructor(
    @Inject(AUTH_SESSIONS_REPOSITORY)
    private readonly sessions: AuthSessionsRepository,
  ) {}

  async execute(input: RevokeOtherSessionsInput): Promise<number> {
    return this.sessions.revokeOthers(
      input.userId,
      input.currentSessionId,
      new Date(),
    );
  }
}
