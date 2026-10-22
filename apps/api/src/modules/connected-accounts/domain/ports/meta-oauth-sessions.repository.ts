import type { MetaOAuthSession, MetaPageAsset } from '../meta-oauth.entity.js';

export const META_OAUTH_SESSIONS_REPOSITORY: unique symbol = Symbol(
  'META_OAUTH_SESSIONS_REPOSITORY',
);

export interface CreateMetaOAuthSessionInput {
  readonly brandId: string;
  readonly userId: string;
  /** SHA-256 hex del `state`; el valor en claro jamás toca la base. */
  readonly stateHash: string;
  readonly expiresAt: Date;
}

/**
 * Persistencia de sesiones temporales de OAuth.
 * El payload (páginas + Page tokens) viaja cifrado con `ENCRYPTION_KEY` y se
 * descifra al leerlo; se borra al completar o fallar.
 */
export interface MetaOAuthSessionsRepository {
  createSession(input: CreateMetaOAuthSessionInput): Promise<MetaOAuthSession>;
  findByStateHash(stateHash: string): Promise<MetaOAuthSession | null>;
  getSession(id: string): Promise<MetaOAuthSession | null>;
  /** Consumo atómico y de un solo uso del `state` (marca `stateConsumedAt`). */
  consumeState(id: string, now: Date): Promise<boolean>;
  markReady(id: string, pages: readonly MetaPageAsset[]): Promise<void>;
  markFailed(id: string, code: string, message: string): Promise<void>;
  completeSession(id: string): Promise<void>;
  /** Descarta sesiones previas no completadas del mismo usuario y marca. */
  invalidateActiveSessions(brandId: string, userId: string): Promise<void>;
  deleteExpired(now: Date): Promise<void>;
}
