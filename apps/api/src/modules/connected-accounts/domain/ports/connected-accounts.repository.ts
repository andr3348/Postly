import type {
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
}

export interface ConnectedAccountsRepository {
  upsertAccount(brandId: string, payload: UpsertAccountPayload): Promise<ConnectedAccount>;
  findAllByBrand(brandId: string): Promise<ConnectedAccount[]>;
  disconnectAccount(brandId: string, platform: AccountPlatform): Promise<boolean>;
  getCredentialsForDispatch(
    brandId: string,
    platforms: AccountPlatform[],
  ): Promise<ConnectedAccountWithCredentials[]>;
}
