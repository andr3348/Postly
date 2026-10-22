import { Inject, Injectable } from '@nestjs/common';
import { MetaOAuthError } from '../../../shared/errors.js';
import type {
  MetaInstagramAsset,
  MetaPageAsset,
  MetaTokenDebugInfo,
} from '../domain/meta-oauth.entity.js';
import type { MetaOAuthClient } from '../domain/ports/meta-oauth-client.port.js';
import {
  META_OAUTH_OPTIONS,
  type MetaOAuthOptions,
} from './meta-oauth.options.js';

const TIMEOUT_MS = 8000;
const PAGES_PAGE_LIMIT = '200';

/**
 * Cliente del OAuth de Meta (fetch nativo, sin dependencias nuevas).
 * - Diálogo: `www.facebook.com` (Facebook Login for Business).
 * - Datos y tokens: `graph.facebook.com`, versión configurable (default v25.0).
 * - El App Secret solo se usa aquí (intercambio de token y debug_token).
 * - Los Page tokens nunca se registran ni salen en errores.
 */
@Injectable()
export class MetaGraphOAuthClient implements MetaOAuthClient {
  constructor(
    @Inject(META_OAUTH_OPTIONS) private readonly options: MetaOAuthOptions | null,
  ) {}

  buildAuthorizationUrl(state: string): string {
    const options = this.requireOptions();
    const url = new URL(
      `https://www.facebook.com/${options.graphVersion}/dialog/oauth`,
    );
    url.searchParams.set('client_id', options.appId);
    url.searchParams.set('redirect_uri', options.redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('response_type', 'code');
    if (options.configId !== null) {
      // Facebook Login for Business: el config_id define permisos y activos;
      // el response_type code requiere override explícito.
      url.searchParams.set('config_id', options.configId);
      url.searchParams.set('override_default_response_type', 'true');
    } else {
      url.searchParams.set('scope', options.scopes.join(','));
    }
    return url.toString();
  }

  buildFrontendUrl(path: string): string {
    const options = this.requireOptions();
    return new URL(path, options.webAppUrl).toString();
  }

  async exchangeCodeForLongLivedUserToken(code: string): Promise<string> {
    const options = this.requireOptions();
    const tokenEndpoint = `https://graph.facebook.com/${options.graphVersion}/oauth/access_token`;

    const shortLived = await this.graphGet(tokenEndpoint, {
      client_id: options.appId,
      client_secret: options.appSecret,
      redirect_uri: options.redirectUri,
      code,
    });
    const shortToken = readString(shortLived, 'access_token');
    if (shortToken === null) {
      throw new MetaOAuthError(
        'META_OAUTH_EXCHANGE_FAILED',
        'Meta no devolvió un token válido. Inténtalo de nuevo.',
      );
    }

    const longLived = await this.graphGet(tokenEndpoint, {
      grant_type: 'fb_exchange_token',
      client_id: options.appId,
      client_secret: options.appSecret,
      fb_exchange_token: shortToken,
    });
    return readString(longLived, 'access_token') ?? shortToken;
  }

  async listPages(userAccessToken: string): Promise<MetaPageAsset[]> {
    const options = this.requireOptions();
    const body = await this.graphGet(
      `https://graph.facebook.com/${options.graphVersion}/me/accounts`,
      {
        fields: 'id,name,access_token,tasks,instagram_business_account{id,username}',
        limit: PAGES_PAGE_LIMIT,
        access_token: userAccessToken,
      },
    );

    const data = body['data'];
    if (!Array.isArray(data)) {
      return [];
    }

    const pages: MetaPageAsset[] = [];
    for (const entry of data) {
      const page = readObject(entry);
      const id = readString(page, 'id');
      const name = readString(page, 'name');
      const accessToken = readString(page, 'access_token');
      if (id === null || name === null || accessToken === null) {
        continue;
      }
      const tasks = Array.isArray(page?.['tasks'])
        ? page['tasks'].filter((task): task is string => typeof task === 'string')
        : [];
      pages.push({
        id,
        name,
        accessToken,
        tasks,
        instagram: readInstagram(page?.['instagram_business_account']),
      });
    }
    return pages;
  }

  async debugPageToken(pageAccessToken: string): Promise<MetaTokenDebugInfo> {
    const options = this.requireOptions();
    const body = await this.graphGet(
      `https://graph.facebook.com/${options.graphVersion}/debug_token`,
      {
        input_token: pageAccessToken,
        access_token: `${options.appId}|${options.appSecret}`,
      },
    );
    const data = readObject(body['data']);
    const expiresAtSeconds =
      typeof data?.['expires_at'] === 'number' ? data['expires_at'] : 0;
    const scopes = Array.isArray(data?.['scopes'])
      ? data['scopes'].filter((scope): scope is string => typeof scope === 'string')
      : [];
    return {
      isValid: data?.['is_valid'] === true,
      // `expires_at: 0` = token que no vence (Page token típico).
      expiresAt: expiresAtSeconds > 0 ? new Date(expiresAtSeconds * 1000) : null,
      scopes,
    };
  }

  async getPageInstagram(
    pageId: string,
    pageAccessToken: string,
  ): Promise<MetaInstagramAsset | null> {
    const options = this.requireOptions();
    const body = await this.graphGet(
      `https://graph.facebook.com/${options.graphVersion}/${encodeURIComponent(pageId)}`,
      {
        fields: 'instagram_business_account{id,username}',
        access_token: pageAccessToken,
      },
    );
    return readInstagram(body['instagram_business_account']);
  }

  private async graphGet(
    endpoint: string,
    params: Readonly<Record<string, string>>,
  ): Promise<Record<string, unknown>> {
    const url = new URL(endpoint);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new MetaOAuthError(
        'META_GRAPH_ERROR',
        'No se pudo contactar a Meta. Revisa la conexión e inténtalo de nuevo.',
        502,
      );
    }

    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok) {
      const error = readObject(body?.['error']);
      const detail = readString(error, 'message') ?? `HTTP ${response.status}`;
      const numericCode = toNumericCode(error?.['code']);
      const invalidToken = numericCode === 190 || numericCode === 102;
      throw new MetaOAuthError(
        invalidToken ? 'META_TOKEN_EXPIRED' : 'META_GRAPH_ERROR',
        invalidToken
          ? 'La conexión con Meta venció. Vuelve a conectar la cuenta.'
          : `Meta rechazó la operación: ${detail}`,
        400,
      );
    }
    return body ?? {};
  }

  private requireOptions(): MetaOAuthOptions {
    if (this.options === null) {
      throw new MetaOAuthError(
        'META_OAUTH_NOT_CONFIGURED',
        'La conexión con Meta no está configurada en el servidor. Revisa META_APP_ID, META_APP_SECRET, META_OAUTH_REDIRECT_URI y WEB_APP_URL.',
        503,
      );
    }
    return this.options;
  }
}

function readObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function readString(
  record: Record<string, unknown> | null,
  key: string,
): string | null {
  const value = record?.[key];
  return typeof value === 'string' && value !== '' ? value : null;
}

function toNumericCode(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function readInstagram(value: unknown): MetaInstagramAsset | null {
  const record = readObject(value);
  const id = readString(record, 'id');
  const username = readString(record, 'username');
  return id === null || username === null ? null : { id, username };
}
