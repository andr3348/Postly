import { Platform, AccountStatus } from '@postly/database';

export interface ConnectedAccount {
  id: string;
  brandId: string;
  platform: Platform;
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
