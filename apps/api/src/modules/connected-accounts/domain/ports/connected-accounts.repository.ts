import { ConnectedAccount, ConnectedAccountWithCredentials } from '../connected-account.entity.js';
import { Platform } from '@postly/database';

export const CONNECTED_ACCOUNTS_REPOSITORY = Symbol('CONNECTED_ACCOUNTS_REPOSITORY');

export interface UpsertAccountPayload {
  platform: Platform;
  accountName: string;
  externalAccountId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
}

export interface ConnectedAccountsRepository {
  upsertAccount(brandId: string, payload: UpsertAccountPayload): Promise<ConnectedAccount>;
  findAllByBrand(brandId: string): Promise<ConnectedAccount[]>;
  disconnectAccount(brandId: string, platform: Platform): Promise<void>;
  getCredentialsForDispatch(brandId: string, platforms: Platform[]): Promise<ConnectedAccountWithCredentials[]>;
}
