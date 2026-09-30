import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type {
  ConnectedAccountsRepository,
  UpsertAccountPayload,
} from '../domain/ports/connected-accounts.repository.js';
import type {
  AccountPlatform,
  AccountStatus,
  ConnectedAccount,
  ConnectedAccountWithCredentials,
} from '../domain/connected-account.entity.js';
import { decrypt, encrypt } from '../../../shared/encryption.js';

@Injectable()
export class PrismaConnectedAccountsRepository implements ConnectedAccountsRepository {
  private readonly encryptionKey: string;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    const key = configService.get<string>('ENCRYPTION_KEY');
    if (key === undefined || key === '') {
      throw new Error(
        '[connected-accounts] Missing ENCRYPTION_KEY. Define it in the api environment (64 hex chars).',
      );
    }
    this.encryptionKey = key;
  }

  async upsertAccount(brandId: string, payload: UpsertAccountPayload): Promise<ConnectedAccount> {
    const encryptedAccessToken = encrypt(payload.accessToken, this.encryptionKey);
    const encryptedRefreshToken =
      payload.refreshToken === undefined
        ? undefined
        : encrypt(payload.refreshToken, this.encryptionKey);

    const account = await this.prisma.client.connectedAccount.upsert({
      where: {
        brandId_platform: {
          brandId,
          platform: payload.platform,
        },
      },
      create: {
        brandId,
        platform: payload.platform,
        status: payload.status,
        accountName: payload.accountName,
        externalAccountId: payload.externalAccountId,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: payload.expiresAt,
        scope: payload.scope,
      },
      update: {
        accountName: payload.accountName,
        externalAccountId: payload.externalAccountId,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: payload.expiresAt,
        scope: payload.scope,
        status: payload.status,
      },
    });

    return toDomainAccount(account);
  }

  async findAllByBrand(brandId: string): Promise<ConnectedAccount[]> {
    const accounts = await this.prisma.client.connectedAccount.findMany({
      where: { brandId },
      select: {
        id: true,
        brandId: true,
        platform: true,
        status: true,
        accountName: true,
        externalAccountId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return accounts.map(toDomainAccount);
  }

  async disconnectAccount(brandId: string, platform: AccountPlatform): Promise<boolean> {
    const disconnected = await this.prisma.client.connectedAccount.updateMany({
      // Solo un vínculo activo se puede desvincular: repetir sobre una cuenta
      // ya DISCONNECTED es 404, no éxito silencioso.
      where: { brandId, platform, status: { in: ['CONNECTED', 'EXPIRED'] } },
      // Desvincular = sin credenciales: no retener secretos de una cuenta suelta.
      data: { status: 'DISCONNECTED', accessToken: null, refreshToken: null },
    });
    return disconnected.count > 0;
  }

  async getCredentialsForDispatch(
    brandId: string,
    platforms: AccountPlatform[],
  ): Promise<ConnectedAccountWithCredentials[]> {
    const accounts = await this.prisma.client.connectedAccount.findMany({
      where: {
        brandId,
        platform: { in: platforms },
        status: 'CONNECTED',
      },
    });

    return accounts.map((account) => ({
      ...toDomainAccount(account),
      accessToken: account.accessToken === null ? null : decrypt(account.accessToken, this.encryptionKey),
      refreshToken:
        account.refreshToken === null ? null : decrypt(account.refreshToken, this.encryptionKey),
      expiresAt: account.expiresAt,
      scope: account.scope,
    }));
  }
}

interface AccountRow {
  readonly id: string;
  readonly brandId: string;
  readonly platform: string;
  readonly status: string;
  readonly accountName: string;
  readonly externalAccountId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

function toDomainAccount(row: AccountRow): ConnectedAccount {
  return {
    id: row.id,
    brandId: row.brandId,
    platform: toDomainPlatform(row.platform),
    status: toDomainStatus(row.status),
    accountName: row.accountName,
    externalAccountId: row.externalAccountId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toDomainPlatform(value: string): AccountPlatform {
  if (value === 'FACEBOOK' || value === 'INSTAGRAM' || value === 'LINKEDIN' || value === 'TIKTOK') {
    return value;
  }
  throw new Error(`[connected-accounts] Unknown platform in database: ${value}`);
}

function toDomainStatus(value: string): AccountStatus {
  if (value === 'CONNECTED' || value === 'DISCONNECTED' || value === 'EXPIRED') {
    return value;
  }
  throw new Error(`[connected-accounts] Unknown account status in database: ${value}`);
}
