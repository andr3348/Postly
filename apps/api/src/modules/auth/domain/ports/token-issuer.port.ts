import type { UserRole } from '../user.entity.js';

/** Par de tokens emitido en login, registro y refresh. */
export interface AuthTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
}

/** Payload del access JWT (también expuesto como `request.user`). */
export interface AccessPayload {
  readonly userId: string;
  readonly email: string;
  readonly role: UserRole;
  /**
   * Sesión de login a la que pertenece el token. El guard la valida contra
   * la BD para que revocar una sesión invalide el access de inmediato.
   */
  readonly sessionId: string;
}

/**
 * Puerto de emisión y verificación del access JWT.
 * El refresh NO es JWT: es opaco y se persiste hasheado (ver
 * `RefreshTokenService` y `AuthSessionsRepository`).
 */
export interface TokenIssuer {
  issueAccessToken(
    user: {
      id: string;
      email: string;
      role: UserRole;
    },
    sessionId: string,
  ): Promise<string>;
  verifyAccessToken(token: string): Promise<AccessPayload | null>;
}

export const TOKEN_ISSUER: unique symbol = Symbol('TokenIssuer');
