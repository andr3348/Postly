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

/** Origen del vínculo: token manual (respaldo) u OAuth de Meta. */
export type AccountAuthType = 'MANUAL' | 'META_OAUTH';

export interface ConnectedAccount {
  id: string;
  brandId: string;
  platform: AccountPlatform;
  status: AccountStatus;
  /** OAuth vs token pegado a mano; la UI lo muestra como procedencia. */
  authType: AccountAuthType;
  /**
   * Página de Facebook de la que depende la cuenta: en FACEBOOK coincide con
   * `externalAccountId`; en INSTAGRAM apunta a la Page que presta el token.
   */
  metaPageId: string | null;
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
