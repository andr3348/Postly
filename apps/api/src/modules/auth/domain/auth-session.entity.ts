import type { AuthTokens } from './ports/token-issuer.port.js';
import type { SafeUser } from './user.entity.js';

/**
 * Sesión de login (una por dispositivo/navegador). No guarda tokens en claro:
 * el refresh se persiste hasheado en `RefreshToken`.
 */
export interface AuthSession {
  readonly id: string;
  readonly userId: string;
  /** `true` si el usuario marcó "Mantener sesión activa" (cookie persistente). */
  readonly persistent: boolean;
  readonly userAgent: string | null;
  readonly ip: string | null;
  readonly expiresAt: Date;
  readonly lastUsedAt: Date;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Resultado de login/registro/refresh: usuario + tokens + sesión emitida. */
export interface AuthResult {
  readonly user: SafeUser;
  readonly tokens: AuthTokens;
  readonly session: {
    readonly id: string;
    readonly persistent: boolean;
  };
}

/** Vista pública de una sesión para el dashboard (sin hashes ni tokens). */
export interface AuthSessionView {
  readonly id: string;
  readonly current: boolean;
  readonly persistent: boolean;
  readonly userAgent: string | null;
  readonly ip: string | null;
  readonly createdAt: Date;
  readonly lastUsedAt: Date;
  readonly expiresAt: Date;
}
