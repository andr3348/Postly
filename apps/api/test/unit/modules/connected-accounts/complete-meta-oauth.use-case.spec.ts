import { MetaOAuthError } from '../../../../src/shared/errors.js';
import { CompleteMetaOAuthUseCase } from '../../../../src/modules/connected-accounts/application/complete-meta-oauth.use-case.js';
import type { MetaPageConnectionPayload } from '../../../../src/modules/connected-accounts/domain/ports/connected-accounts.repository.js';
import type { ConnectedAccountWithCredentials } from '../../../../src/modules/connected-accounts/domain/connected-account.entity.js';
import {
  BASE_ACCOUNT,
  BASE_BRAND,
  BASE_PAGE,
  metaSession,
  stubBrandsRepository,
  stubConnectedAccountsRepository,
  stubMetaOAuthClient,
  stubMetaOAuthSessionsRepository,
} from './test-stubs.js';

const USER_ID = 'user-1';

function instagramAccount(
  overrides: Partial<ConnectedAccountWithCredentials> = {},
): ConnectedAccountWithCredentials {
  return {
    ...BASE_ACCOUNT,
    id: 'ig-account',
    platform: 'INSTAGRAM',
    authType: 'META_OAUTH',
    metaPageId: 'page-1',
    accountName: 'ig_e2e',
    externalAccountId: 'ig-1',
    accessToken: 'existing-page-token',
    refreshToken: null,
    expiresAt: null,
    scope: null,
    ...overrides,
  };
}

describe('CompleteMetaOAuthUseCase', () => {
  it('persists the page as META_OAUTH and completes the session', async () => {
    const persisted: MetaPageConnectionPayload[] = [];
    const completed: string[] = [];
    const accounts = stubConnectedAccountsRepository({
      upsertMetaPage: async (brandId, payload) => {
        persisted.push(payload);
        return {
          account: {
            ...BASE_ACCOUNT,
            id: 'fb-account',
            brandId,
            platform: 'FACEBOOK',
            authType: 'META_OAUTH',
            metaPageId: payload.page.externalAccountId,
            accountName: payload.page.accountName,
            externalAccountId: payload.page.externalAccountId,
          },
          instagram: null,
        };
      },
    });
    const sessions = stubMetaOAuthSessionsRepository({
      getSession: async () => metaSession(),
      completeSession: async (id) => {
        completed.push(id);
      },
    });
    const useCase = new CompleteMetaOAuthUseCase(
      stubBrandsRepository(),
      accounts,
      sessions,
      stubMetaOAuthClient(),
    );

    const result = await useCase.execute({
      brandId: BASE_BRAND.id,
      userId: USER_ID,
      sessionId: 'session-1',
      pageId: BASE_PAGE.id,
    });

    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.page.externalAccountId).toBe('page-1');
    expect(persisted[0]?.instagram).toBeNull();
    expect(completed).toEqual(['session-1']);
    expect(result.account.platform).toBe('FACEBOOK');
    expect(result.instagram).toEqual({ id: 'ig-1', username: 'ig_e2e' });
  });

  it('synchronizes Instagram when it belongs to the same page', async () => {
    const persisted: MetaPageConnectionPayload[] = [];
    const accounts = stubConnectedAccountsRepository({
      findByBrandAndPlatform: async () => instagramAccount(),
      upsertMetaPage: async (brandId, payload) => {
        persisted.push(payload);
        return {
          account: { ...BASE_ACCOUNT, brandId, platform: 'FACEBOOK' },
          instagram: { ...BASE_ACCOUNT, brandId, platform: 'INSTAGRAM' },
        };
      },
    });
    const sessions = stubMetaOAuthSessionsRepository({
      getSession: async () => metaSession(),
    });
    const useCase = new CompleteMetaOAuthUseCase(
      stubBrandsRepository(),
      accounts,
      sessions,
      stubMetaOAuthClient(),
    );

    await useCase.execute({
      brandId: BASE_BRAND.id,
      userId: USER_ID,
      sessionId: 'session-1',
      pageId: BASE_PAGE.id,
    });

    expect(persisted[0]?.instagram).toEqual({
      externalAccountId: 'ig-1',
      accountName: 'ig_e2e',
    });
  });

  it('blocks changing to a page whose Instagram differs', async () => {
    const persisted: MetaPageConnectionPayload[] = [];
    const accounts = stubConnectedAccountsRepository({
      findByBrandAndPlatform: async () => instagramAccount({ externalAccountId: 'ig-old' }),
      upsertMetaPage: async (brandId, payload) => {
        persisted.push(payload);
        return { account: { ...BASE_ACCOUNT, brandId }, instagram: null };
      },
    });
    const sessions = stubMetaOAuthSessionsRepository({
      getSession: async () => metaSession(),
    });
    const useCase = new CompleteMetaOAuthUseCase(
      stubBrandsRepository(),
      accounts,
      sessions,
      stubMetaOAuthClient(),
    );

    await expect(
      useCase.execute({
        brandId: BASE_BRAND.id,
        userId: USER_ID,
        sessionId: 'session-1',
        pageId: BASE_PAGE.id,
      }),
    ).rejects.toMatchObject({ code: 'META_PAGE_MISMATCH', httpStatus: 409 });
    expect(persisted).toHaveLength(0);
  });

  it('blocks when the selected page has no Instagram but one is connected', async () => {
    const accounts = stubConnectedAccountsRepository({
      findByBrandAndPlatform: async () => instagramAccount(),
    });
    const sessions = stubMetaOAuthSessionsRepository({
      getSession: async () =>
        metaSession({
          pages: [{ ...BASE_PAGE, instagram: null }],
        }),
    });
    const useCase = new CompleteMetaOAuthUseCase(
      stubBrandsRepository(),
      accounts,
      sessions,
      stubMetaOAuthClient(),
    );

    await expect(
      useCase.execute({
        brandId: BASE_BRAND.id,
        userId: USER_ID,
        sessionId: 'session-1',
        pageId: BASE_PAGE.id,
      }),
    ).rejects.toMatchObject({ code: 'META_PAGE_MISMATCH' });
  });

  it('rejects an invalid page token and fails the session', async () => {
    const failed: Array<{ code: string }> = [];
    const sessions = stubMetaOAuthSessionsRepository({
      getSession: async () => metaSession(),
      markFailed: async (_id, code) => {
        failed.push({ code });
      },
    });
    const client = stubMetaOAuthClient({
      debugPageToken: async () => ({ isValid: false, expiresAt: null, scopes: [] }),
    });
    const useCase = new CompleteMetaOAuthUseCase(
      stubBrandsRepository(),
      stubConnectedAccountsRepository(),
      sessions,
      client,
    );

    await expect(
      useCase.execute({
        brandId: BASE_BRAND.id,
        userId: USER_ID,
        sessionId: 'session-1',
        pageId: BASE_PAGE.id,
      }),
    ).rejects.toMatchObject({ code: 'META_TOKEN_EXPIRED' });
    expect(failed).toEqual([{ code: 'META_TOKEN_EXPIRED' }]);
  });

  it('rejects a session owned by another user with 404', async () => {
    const sessions = stubMetaOAuthSessionsRepository({
      getSession: async () => metaSession({ userId: 'someone-else' }),
    });
    const useCase = new CompleteMetaOAuthUseCase(
      stubBrandsRepository(),
      stubConnectedAccountsRepository(),
      sessions,
      stubMetaOAuthClient(),
    );

    await expect(
      useCase.execute({
        brandId: BASE_BRAND.id,
        userId: USER_ID,
        sessionId: 'session-1',
        pageId: BASE_PAGE.id,
      }),
    ).rejects.toMatchObject({ code: 'META_OAUTH_SESSION_NOT_FOUND' });
  });

  it('rejects unknown pages with a domain error', async () => {
    const sessions = stubMetaOAuthSessionsRepository({
      getSession: async () => metaSession(),
    });
    const useCase = new CompleteMetaOAuthUseCase(
      stubBrandsRepository(),
      stubConnectedAccountsRepository(),
      sessions,
      stubMetaOAuthClient(),
    );

    await expect(
      useCase.execute({
        brandId: BASE_BRAND.id,
        userId: USER_ID,
        sessionId: 'session-1',
        pageId: 'missing-page',
      }),
    ).rejects.toBeInstanceOf(MetaOAuthError);
  });
});
