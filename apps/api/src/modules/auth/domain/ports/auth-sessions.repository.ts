import type { AuthSession } from '../auth-session.entity.js';

export interface CreateAuthSessionInput {
  readonly userId: string;
  readonly persistent: boolean;
  readonly userAgent: string | null;
  readonly ip: string | null;
  readonly tokenHash: string;
  readonly tokenExpiresAt: Date;
  readonly sessionExpiresAt: Date;
  readonly now: Date;
}

export interface RotateRefreshTokenInput {
  readonly currentTokenHash: string;
  readonly nextTokenHash: string;
  readonly nextTokenExpiresAt: Date;
  readonly now: Date;
}

/**
 * Resultado de rotar un refresh token.
 * - `ROTATED`: token consumido y reemplazado por uno nuevo.
 * - `INVALID`: token inexistente, vencido o de una sesión revocada.
 * - `REUSED`: token ya consumido fuera de la ventana de gracia; la sesión
 *   quedó revocada (posible robo).
 */
export type RotateRefreshTokenResult =
  | { readonly status: 'ROTATED'; readonly session: AuthSession }
  | { readonly status: 'INVALID' }
  | { readonly status: 'REUSED' };

export interface AuthSessionsRepository {
  /** Crea la sesión y su primer refresh token (hash) en una sola operación. */
  create(input: CreateAuthSessionInput): Promise<AuthSession>;
  rotate(input: RotateRefreshTokenInput): Promise<RotateRefreshTokenResult>;
  /** `true` solo si la sesión pertenece al usuario y sigue vigente. */
  isActive(sessionId: string, userId: string, now: Date): Promise<boolean>;
  listActiveByUser(userId: string, now: Date): Promise<AuthSession[]>;
  /** Revoca una sesión propia. Idempotente: `false` si no existía. */
  revokeById(sessionId: string, userId: string, now: Date): Promise<boolean>;
  /** Logout: revoca la sesión a la que pertenece el refresh (aunque ya se haya usado). */
  revokeByRefreshTokenHash(tokenHash: string, now: Date): Promise<boolean>;
  /** Cierra todas las sesiones del usuario menos la actual. */
  revokeOthers(userId: string, currentSessionId: string, now: Date): Promise<number>;
  /** Limpieza oportunista de sesiones vencidas del usuario (login/registro). */
  deleteExpiredForUser(userId: string, now: Date): Promise<void>;
}

export const AUTH_SESSIONS_REPOSITORY: unique symbol = Symbol('AuthSessionsRepository');
