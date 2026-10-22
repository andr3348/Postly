import type {
  MetaInstagramAsset,
  MetaPageAsset,
  MetaTokenDebugInfo,
} from '../meta-oauth.entity.js';

export const META_OAUTH_CLIENT: unique symbol = Symbol('META_OAUTH_CLIENT');

/**
 * Puerta al OAuth de Meta. Aísla URLs, versión de Graph y secretos; los
 * casos de uso nunca ven `fetch` ni el App Secret.
 */
export interface MetaOAuthClient {
  /** URL del diálogo de Facebook Login for Business para el `state` dado. */
  buildAuthorizationUrl(state: string): string;
  /** URL absoluta del dashboard para volver tras el callback. */
  buildFrontendUrl(path: string): string;
  /** `code` → token de usuario de larga duración (nunca se persiste). */
  exchangeCodeForLongLivedUserToken(code: string): Promise<string>;
  /** Páginas administradas por el usuario, con su Page token e IG vinculado. */
  listPages(userAccessToken: string): Promise<MetaPageAsset[]>;
  debugPageToken(pageAccessToken: string): Promise<MetaTokenDebugInfo>;
  /** `null` si la Page no tiene cuenta profesional de Instagram vinculada. */
  getPageInstagram(
    pageId: string,
    pageAccessToken: string,
  ): Promise<MetaInstagramAsset | null>;
}
