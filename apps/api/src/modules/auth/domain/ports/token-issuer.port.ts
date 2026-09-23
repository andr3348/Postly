import type { UserRole } from '../user.entity.js';

/** Par de tokens emitido en login, registro y refresh. */
export interface AuthTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
}

/** Payload mínimo del access token (también expuesto como `request.user`). */
export interface AccessPayload {
  readonly userId: string;
  readonly email: string;
  readonly role: UserRole;
}

/**
 * Puerto de emisión y verificación de JWT.
 * Ambos tokens son stateless (firma + expiración, sin tabla en BD):
 * no hay revocación ni sesiones en esta fase del proyecto.
 */
export interface TokenIssuer {
  issuePair(user: {
    id: string;
    email: string;
    role: UserRole;
  }): Promise<AuthTokens>;
  verifyAccessToken(token: string): Promise<AccessPayload | null>;
  verifyRefreshToken(token: string): Promise<{ userId: string } | null>;
}

export const TOKEN_ISSUER: unique symbol = Symbol('TokenIssuer');
