/**
 * Emisión y hash de refresh tokens opacos (no JWT).
 * El token en claro solo viaja en la cookie HttpOnly; en BD queda el hash.
 */
export interface GeneratedRefreshToken {
  readonly token: string;
  readonly hash: string;
  readonly expiresAt: Date;
}

export interface RefreshTokenService {
  issue(): GeneratedRefreshToken;
  hash(token: string): string;
}

export const REFRESH_TOKEN_SERVICE: unique symbol = Symbol('RefreshTokenService');
