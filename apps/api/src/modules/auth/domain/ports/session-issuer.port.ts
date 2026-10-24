import type { AuthResult } from '../auth-session.entity.js';
import type { User } from '../user.entity.js';

export interface SessionContext {
  readonly persistent: boolean;
  readonly userAgent: string | null;
  readonly ip: string | null;
}

/**
 * Crea una sesión nueva y emite el access JWT + refresh opaco.
 * Lo usan login y registro; el refresh reutiliza la misma sesión rotando
 * el refresh token (no crea una sesión adicional).
 */
export interface SessionIssuer {
  issue(user: User, context: SessionContext): Promise<AuthResult>;
}

export const SESSION_ISSUER: unique symbol = Symbol('SessionIssuer');
