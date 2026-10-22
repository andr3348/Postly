import type {
  AccountAuthType,
  AccountPlatform,
  AccountStatus,
  ConnectedAccount,
  ConnectedAccountWithCredentials,
} from '../connected-account.entity.js';

export const CONNECTED_ACCOUNTS_REPOSITORY: unique symbol = Symbol('CONNECTED_ACCOUNTS_REPOSITORY');

export interface UpsertAccountPayload {
  platform: AccountPlatform;
  accountName: string;
  externalAccountId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
  status: AccountStatus;
  /** Default `MANUAL` (token pegado a mano). */
  authType?: AccountAuthType;
  metaPageId?: string | null;
}

/**
 * Persistencia atómica del alta OAuth de una Page: crea/actualiza Facebook y,
 * si la marca ya tiene su Instagram de esa misma página, sincroniza el token
 * de Instagram (comparten Page access token).
 */
export interface MetaPageConnectionPayload {
  readonly page: {
    readonly externalAccountId: string;
    readonly accountName: string;
    readonly accessToken: string;
    readonly expiresAt: Date | null;
    readonly scope: string | null;
  };
  /** `null` = no tocar Instagram (aún no conectado o no aplica). */
  readonly instagram: {
    readonly externalAccountId: string;
    readonly accountName: string;
  } | null;
}

export interface MetaPageConnectionResult {
  readonly account: ConnectedAccount;
  readonly instagram: ConnectedAccount | null;
}

export interface ConnectedAccountsRepository {
  upsertAccount(brandId: string, payload: UpsertAccountPayload): Promise<ConnectedAccount>;
  findAllByBrand(brandId: string): Promise<ConnectedAccount[]>;
  findByBrandAndPlatform(
    brandId: string,
    platform: AccountPlatform,
  ): Promise<ConnectedAccountWithCredentials | null>;
  /** Alta/actualización de la Page como OAuth, con sincronía opcional de IG. */
  upsertMetaPage(
    brandId: string,
    payload: MetaPageConnectionPayload,
  ): Promise<MetaPageConnectionResult>;
  disconnectAccount(brandId: string, platform: AccountPlatform): Promise<boolean>;
  /** Marca cuentas como EXPIRED conservando sus tokens (reintento de OAuth). */
  markExpired(brandId: string, platforms: AccountPlatform[]): Promise<void>;
  getCredentialsForDispatch(
    brandId: string,
    platforms: AccountPlatform[],
  ): Promise<ConnectedAccountWithCredentials[]>;
}
