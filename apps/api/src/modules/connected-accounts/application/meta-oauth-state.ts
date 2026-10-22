import { createHash } from 'node:crypto';

/**
 * Hash del `state` de OAuth antes de persistirlo. La base guarda solo el
 * SHA-256: un volcado de `MetaOAuthSession` no permite reusar el state.
 */
export function hashMetaOAuthState(state: string): string {
  return createHash('sha256').update(state).digest('hex');
}
