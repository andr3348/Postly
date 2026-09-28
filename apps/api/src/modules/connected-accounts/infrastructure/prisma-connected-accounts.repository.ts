import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type {
  ConnectedAccountsRepository,
  UpsertAccountPayload,
} from '../domain/ports/connected-accounts.repository.js';
import type { ConnectedAccount, ConnectedAccountWithCredentials } from '../domain/connected-account.entity.js';
import type { Platform } from '@postly/database';
import { encrypt, decrypt } from '../../../shared/encryption.js';

@Injectable()
export class PrismaConnectedAccountsRepository implements ConnectedAccountsRepository {
  private readonly encryptionKey: string;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    const key = configService.get<string>('ENCRYPTION_KEY');
    if (!key) {
      throw new InternalServerErrorException('ENCRYPTION_KEY is missing');
    }
    this.encryptionKey = key;
  }

  async upsertAccount(brandId: string, payload: UpsertAccountPayload): Promise<ConnectedAccount> {
    const encryptedAccessToken = encrypt(payload.accessToken, this.encryptionKey);
    const encryptedRefreshToken = payload.refreshToken ? encrypt(payload.refreshToken, this.encryptionKey) : undefined;

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
        status: 'CONNECTED',
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
        status: 'CONNECTED',
      },
    });

    return this.mapToDomain(account);
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

    return accounts.map(this.mapToDomain);
  }

  async disconnectAccount(brandId: string, platform: Platform): Promise<void> {
    await this.prisma.client.connectedAccount.updateMany({
      where: {
        brandId,
        platform,
      },
      data: {
        status: 'DISCONNECTED',
      },
    });
  }

  async getCredentialsForDispatch(
    brandId: string,
    platforms: Platform[],
  ): Promise<ConnectedAccountWithCredentials[]> {
    const accounts = await this.prisma.client.connectedAccount.findMany({
      where: {
        brandId,
        platform: { in: platforms },
        status: 'CONNECTED',
      },
    });

    return accounts.map((acc) => ({
      id: acc.id,
      brandId: acc.brandId,
      platform: acc.platform,
      status: acc.status,
      accountName: acc.accountName,
      externalAccountId: acc.externalAccountId,
      createdAt: acc.createdAt,
      updatedAt: acc.updatedAt,
      accessToken: acc.accessToken ? decrypt(acc.accessToken, this.encryptionKey) : null,
      refreshToken: acc.refreshToken ? decrypt(acc.refreshToken, this.encryptionKey) : null,
      expiresAt: acc.expiresAt,
      scope: acc.scope,
    }));
  }

  private mapToDomain(record: any): ConnectedAccount {
    return {
      id: record.id,
      brandId: record.brandId,
      platform: record.platform,
      status: record.status,
      accountName: record.accountName,
      externalAccountId: record.externalAccountId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
