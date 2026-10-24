import { Inject, Injectable } from '@nestjs/common';
import {
  AUTH_SESSIONS_REPOSITORY,
  type AuthSessionsRepository,
} from '../domain/ports/auth-sessions.repository.js';

export interface RevokeAuthSessionInput {
  readonly userId: string;
  readonly sessionId: string;
  readonly currentSessionId: string;
}

export interface RevokeAuthSessionOutput {
  readonly revokedCurrent: boolean;
}

/** Revoca una sesión propia (idempotente). */
@Injectable()
export class RevokeAuthSessionUseCase {
  constructor(
    @Inject(AUTH_SESSIONS_REPOSITORY)
    private readonly sessions: AuthSessionsRepository,
  ) {}

  async execute(
    input: RevokeAuthSessionInput,
  ): Promise<RevokeAuthSessionOutput> {
    await this.sessions.revokeById(
      input.sessionId,
      input.userId,
      new Date(),
    );
    return { revokedCurrent: input.sessionId === input.currentSessionId };
  }
}
