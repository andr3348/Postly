import { MetaOAuthError } from '../../../shared/errors.js';
import type { MetaOAuthSession } from '../domain/meta-oauth.entity.js';

/**
 * Valida que la sesión exista y pertenezca a la marca y al usuario que inició
 * el flujo (el callback es público; este chequeo evita que otra sesión la use).
 */
export function assertSessionOwnership(
  session: MetaOAuthSession | null,
  brandId: string,
  userId: string,
): MetaOAuthSession {
  if (session === null || session.brandId !== brandId || session.userId !== userId) {
    throw new MetaOAuthError(
      'META_OAUTH_SESSION_NOT_FOUND',
      'La sesión de conexión no existe o ya no está disponible.',
      404,
    );
  }
  return session;
}
