import { MetaOAuthError } from '../../../../src/shared/errors.js';
import { ConnectInstagramFromFacebookUseCase } from '../../../../src/modules/connected-accounts/application/connect-instagram-from-facebook.use-case.js';
import type { UpsertAccountPayload } from '../../../../src/modules/connected-accounts/domain/ports/connected-accounts.repository.js';
import type { ConnectedAccountWithCredentials } from '../../../../src/modules/connected-accounts/domain/connected-account.entity.js';
import {
  BASE_ACCOUNT,
  BASE_BRAND,
  stubBrandsRepository,
  stubConnectedAccountsRepository,
  stubMetaOAuthClient,
} from './test-stubs.js';

function facebookAccount(
  overrides: Partial<ConnectedAccountWithCredentials> = {},
): ConnectedAccountWithCredentials {
  return {
    ...BASE_ACCOUNT,
    id: 'fb-account',
    platform: 'FACEBOOK',
    authType: 'META_OAUTH',
    metaPageId: 'page-1',
    accountName: 'Página E2E',
    externalAccountId: 'page-1',
    accessToken: 'page-access-token',
    refreshToken: null,
    expiresAt: null,
    scope: null,
    ...overrides,
  };
}

describe('ConnectInstagramFromFacebookUseCase', () => {
  it('connects Instagram reusing the stored Page token', async () => {
    const upserts: UpsertAccountPayload[] = [];
    const accounts = stubConnectedAccountsRepository({
      findByBrandAndPlatform: async (_brandId, platform) =>
        platform === 'FACEBOOK' ? facebookAccount() : null,
      upsertAccount: async (brandId, payload) => {
        upserts.push(payload);
        return {
          ...BASE_ACCOUNT,
          brandId,
          platform: payload.platform,
          accountName: payload.accountName,
          externalAccountId: payload.externalAccountId,
        };
      },
    });
    const useCase = new ConnectInstagramFromFacebookUseCase(
      stubBrandsRepository(),
      accounts,
      stubMetaOAuthClient(),
    );

    const account = await useCase.execute(BASE_BRAND.id);

    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toMatchObject({
      platform: 'INSTAGRAM',
      externalAccountId: 'ig-1',
      accountName: 'ig_e2e',
      accessToken: 'page-access-token',
      authType: 'META_OAUTH',
      metaPageId: 'page-1',
      status: 'CONNECTED',
    });
    expect(account.platform).toBe('INSTAGRAM');
  });

  it('requires Facebook first', async () => {
    const accounts = stubConnectedAccountsRepository({
      findByBrandAndPlatform: async () => null,
    });
    const useCase = new ConnectInstagramFromFacebookUseCase(
      stubBrandsRepository(),
      accounts,
      stubMetaOAuthClient(),
    );

    await expect(useCase.execute(BASE_BRAND.id)).rejects.toMatchObject({
      code: 'META_FACEBOOK_NOT_CONNECTED',
      httpStatus: 409,
    });
  });

  it('rejects a page without linked Instagram', async () => {
    const accounts = stubConnectedAccountsRepository({
      findByBrandAndPlatform: async (_brandId, platform) =>
        platform === 'FACEBOOK' ? facebookAccount() : null,
    });
    const client = stubMetaOAuthClient({ getPageInstagram: async () => null });
    const useCase = new ConnectInstagramFromFacebookUseCase(
      stubBrandsRepository(),
      accounts,
      client,
    );

    await expect(useCase.execute(BASE_BRAND.id)).rejects.toMatchObject({
      code: 'META_INSTAGRAM_NOT_LINKED',
    });
  });

  it('marks both Meta accounts EXPIRED when the token is rejected', async () => {
    const expired: string[] = [];
    const accounts = stubConnectedAccountsRepository({
      findByBrandAndPlatform: async (_brandId, platform) =>
        platform === 'FACEBOOK' ? facebookAccount() : null,
      markExpired: async (_brandId, platforms) => {
        expired.push(platforms.join(','));
      },
    });
    const client = stubMetaOAuthClient({
      getPageInstagram: async () => {
        throw new MetaOAuthError('META_TOKEN_EXPIRED', 'venció');
      },
    });
    const useCase = new ConnectInstagramFromFacebookUseCase(
      stubBrandsRepository(),
      accounts,
      client,
    );

    await expect(useCase.execute(BASE_BRAND.id)).rejects.toMatchObject({
      code: 'META_TOKEN_EXPIRED',
    });
    expect(expired).toEqual(['FACEBOOK,INSTAGRAM']);
  });

  it('blocks replacing a different connected Instagram', async () => {
    const accounts = stubConnectedAccountsRepository({
      findByBrandAndPlatform: async (_brandId, platform) =>
        platform === 'FACEBOOK'
          ? facebookAccount()
          : {
              ...BASE_ACCOUNT,
              platform: 'INSTAGRAM',
              externalAccountId: 'ig-other',
              accessToken: null,
              refreshToken: null,
              expiresAt: null,
              scope: null,
            },
    });
    const useCase = new ConnectInstagramFromFacebookUseCase(
      stubBrandsRepository(),
      accounts,
      stubMetaOAuthClient(),
    );

    await expect(useCase.execute(BASE_BRAND.id)).rejects.toMatchObject({
      code: 'META_PAGE_MISMATCH',
    });
  });
});
