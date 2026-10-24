import { Inject, Injectable } from '@nestjs/common';
import type { AuthSessionView } from '../domain/auth-session.entity.js';
import {
  AUTH_SESSIONS_REPOSITORY,
  type AuthSessionsRepository,
} from '../domain/ports/auth-sessions.repository.js';

export interface ListAuthSessionsInput {
  readonly userId: string;
  readonly currentSessionId: string;
}

/** Lista las sesiones activas del usuario y marca la que hace la petición. */
@Injectable()
export class ListAuthSessionsUseCase {
  constructor(
    @Inject(AUTH_SESSIONS_REPOSITORY)
    private readonly sessions: AuthSessionsRepository,
  ) {}

  async execute(input: ListAuthSessionsInput): Promise<AuthSessionView[]> {
    const sessions = await this.sessions.listActiveByUser(
      input.userId,
      new Date(),
    );
    return sessions.map((session) => ({
      id: session.id,
      current: session.id === input.currentSessionId,
      persistent: session.persistent,
      userAgent: session.userAgent,
      ip: session.ip,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      expiresAt: session.expiresAt,
    }));
  }
}
