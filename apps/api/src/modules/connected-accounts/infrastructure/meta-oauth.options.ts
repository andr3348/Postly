import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

/**
 * Configuración del OAuth de Meta (Facebook Login for Business).
 *
 * A diferencia de JWT/ENCRYPTION_KEY, faltante aquí no rompe el arranque:
 * `resolveMetaOAuthOptions` devuelve `null` y los endpoints de conexión
 * responden 503 `META_OAUTH_NOT_CONFIGURED` con un mensaje claro. Así el
 * resto del API sigue usable sin panel de Meta configurado.
 */
const metaOAuthOptionsSchema = z.object({
  appId: z.string().min(1),
  appSecret: z.string().min(1),
  redirectUri: z.string().url(),
  configId: z.string().min(1).nullable(),
  graphVersion: z.string().min(1),
  webAppUrl: z.string().url(),
  scopes: z.array(z.string().min(1)).min(1),
});

export type MetaOAuthOptions = z.infer<typeof metaOAuthOptionsSchema>;

export const META_OAUTH_OPTIONS: unique symbol = Symbol('MetaOAuthOptions');

const DEFAULT_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
] as const;

export function resolveMetaOAuthOptions(config: ConfigService): MetaOAuthOptions | null {
  const appId = config.get<string>('META_APP_ID');
  const appSecret = config.get<string>('META_APP_SECRET');
  const redirectUri = config.get<string>('META_OAUTH_REDIRECT_URI');
  const webAppUrl = config.get<string>('WEB_APP_URL');
  if (
    appId === undefined ||
    appId === '' ||
    appSecret === undefined ||
    appSecret === '' ||
    redirectUri === undefined ||
    redirectUri === '' ||
    webAppUrl === undefined ||
    webAppUrl === ''
  ) {
    return null;
  }

  const rawScopes = config.get<string>('META_OAUTH_SCOPES');
  const scopes =
    rawScopes === undefined || rawScopes.trim() === ''
      ? [...DEFAULT_SCOPES]
      : rawScopes
          .split(',')
          .map((scope) => scope.trim())
          .filter((scope) => scope !== '');

  const configId = config.get<string>('META_OAUTH_CONFIG_ID');
  return metaOAuthOptionsSchema.parse({
    appId,
    appSecret,
    redirectUri,
    configId: configId === undefined || configId === '' ? null : configId,
    graphVersion: config.get<string>('META_GRAPH_VERSION') ?? 'v25.0',
    webAppUrl: webAppUrl.replace(/\/+$/, ''),
    scopes: scopes.length > 0 ? scopes : [...DEFAULT_SCOPES],
  });
}
