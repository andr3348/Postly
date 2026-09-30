/**
 * Entidad de dominio `ConnectedAccount`.
 *
 * Tipo puro: plataformas y estados como uniones locales (el adaptador mapea
 * en el borde). No importar nada de `@postly/database` aquí.
 * Los tokens nunca viajan en esta entidad: solo en
 * `ConnectedAccountWithCredentials`, usada únicamente por el flujo
 * interno de despacho (nunca expuesta en rutas públicas).
 */
export type AccountPlatform = 'FACEBOOK' | 'INSTAGRAM' | 'LINKEDIN' | 'TIKTOK';

export type AccountStatus = 'CONNECTED' | 'DISCONNECTED' | 'EXPIRED';

export interface ConnectedAccount {
  id: string;
  brandId: string;
  platform: AccountPlatform;
  status: AccountStatus;
  accountName: string;
  externalAccountId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConnectedAccountWithCredentials extends ConnectedAccount {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope: string | null;
}
