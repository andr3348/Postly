import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type {
  ConnectedAccountsRepository,
  MetaPageConnectionPayload,
  MetaPageConnectionResult,
  UpsertAccountPayload,
} from '../domain/ports/connected-accounts.repository.js';
import type {
  AccountAuthType,
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
        authType: payload.authType ?? 'MANUAL',
        metaPageId: payload.metaPageId ?? null,
        accountName: payload.accountName,
        externalAccountId: payload.externalAccountId,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: payload.expiresAt,
        scope: payload.scope,
      },
      update: {
        authType: payload.authType ?? 'MANUAL',
        metaPageId: payload.metaPageId ?? null,
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
        authType: true,
        metaPageId: true,
        accountName: true,
        externalAccountId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return accounts.map(toDomainAccount);
  }

  async findByBrandAndPlatform(
    brandId: string,
    platform: AccountPlatform,
  ): Promise<ConnectedAccountWithCredentials | null> {
    const account = await this.prisma.client.connectedAccount.findUnique({
      where: { brandId_platform: { brandId, platform } },
    });
    if (account === null) {
      return null;
    }
    return {
      ...toDomainAccount(account),
      accessToken:
        account.accessToken === null
          ? null
          : decrypt(account.accessToken, this.encryptionKey),
      refreshToken:
        account.refreshToken === null
          ? null
          : decrypt(account.refreshToken, this.encryptionKey),
      expiresAt: account.expiresAt,
      scope: account.scope,
    };
  }

  async upsertMetaPage(
    brandId: string,
    payload: MetaPageConnectionPayload,
  ): Promise<MetaPageConnectionResult> {
    const page = payload.page;
    const encryptedPageToken = encrypt(page.accessToken, this.encryptionKey);
    const pageStatus: AccountStatus =
      page.expiresAt !== null && page.expiresAt.getTime() <= Date.now()
        ? 'EXPIRED'
        : 'CONNECTED';

    return this.prisma.client.$transaction(async (tx) => {
      const facebook = await tx.connectedAccount.upsert({
        where: { brandId_platform: { brandId, platform: 'FACEBOOK' } },
        create: {
          brandId,
          platform: 'FACEBOOK',
          status: pageStatus,
          authType: 'META_OAUTH',
          metaPageId: page.externalAccountId,
          accountName: page.accountName,
          externalAccountId: page.externalAccountId,
          accessToken: encryptedPageToken,
          expiresAt: page.expiresAt,
          scope: page.scope,
        },
        update: {
          status: pageStatus,
          authType: 'META_OAUTH',
          metaPageId: page.externalAccountId,
          accountName: page.accountName,
          externalAccountId: page.externalAccountId,
          accessToken: encryptedPageToken,
          refreshToken: null,
          expiresAt: page.expiresAt,
          scope: page.scope,
        },
      });

      if (payload.instagram === null) {
        return { account: toDomainAccount(facebook), instagram: null };
      }

      // Instagram comparte el Page access token: se sincroniza para que
      // reconectar la misma Page no deje la credencial de IG desactualizada.
      const instagram = await tx.connectedAccount.upsert({
        where: { brandId_platform: { brandId, platform: 'INSTAGRAM' } },
        create: {
          brandId,
          platform: 'INSTAGRAM',
          status: pageStatus,
          authType: 'META_OAUTH',
          metaPageId: page.externalAccountId,
          accountName: payload.instagram.accountName,
          externalAccountId: payload.instagram.externalAccountId,
          accessToken: encryptedPageToken,
          expiresAt: page.expiresAt,
          scope: page.scope,
        },
        update: {
          status: pageStatus,
          authType: 'META_OAUTH',
          metaPageId: page.externalAccountId,
          accountName: payload.instagram.accountName,
          externalAccountId: payload.instagram.externalAccountId,
          accessToken: encryptedPageToken,
          refreshToken: null,
          expiresAt: page.expiresAt,
          scope: page.scope,
        },
      });

      return {
        account: toDomainAccount(facebook),
        instagram: toDomainAccount(instagram),
      };
    });
  }

  async disconnectAccount(brandId: string, platform: AccountPlatform): Promise<boolean> {
    return this.prisma.client.$transaction(async (tx) => {
      // Solo un vínculo activo se puede desvincular: repetir sobre una cuenta
      // ya DISCONNECTED es 404, no éxito silencioso.
      const target = await tx.connectedAccount.findFirst({
        where: { brandId, platform, status: { in: ['CONNECTED', 'EXPIRED'] } },
        select: { id: true },
      });
      if (target === null) {
        return false;
      }

      // Desvincular = sin credenciales: no retener secretos de una cuenta suelta.
      await tx.connectedAccount.update({
        where: { id: target.id },
        data: { status: 'DISCONNECTED', accessToken: null, refreshToken: null },
      });

      // Instagram depende de Facebook: comparte Page token, así que al
      // desconectar la Page también se desvincula (regla confirmada).
      if (platform === 'FACEBOOK') {
        await tx.connectedAccount.updateMany({
          where: {
            brandId,
            platform: 'INSTAGRAM',
            status: { in: ['CONNECTED', 'EXPIRED'] },
          },
          data: { status: 'DISCONNECTED', accessToken: null, refreshToken: null },
        });
      }

      return true;
    });
  }

  async markExpired(brandId: string, platforms: AccountPlatform[]): Promise<void> {
    await this.prisma.client.connectedAccount.updateMany({
      where: { brandId, platform: { in: platforms }, status: 'CONNECTED' },
      data: { status: 'EXPIRED' },
    });
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
  readonly authType: string;
  readonly metaPageId: string | null;
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
    authType: toDomainAuthType(row.authType),
    metaPageId: row.metaPageId,
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

function toDomainAuthType(value: string): AccountAuthType {
  if (value === 'MANUAL' || value === 'META_OAUTH') {
    return value;
  }
  throw new Error(`[connected-accounts] Unknown auth type in database: ${value}`);
}
