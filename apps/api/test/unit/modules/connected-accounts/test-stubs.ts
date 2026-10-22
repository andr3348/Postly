import type { BrandsRepository } from '../../../../src/modules/brand/domain/ports/brands.repository.js';
import type { Brand } from '../../../../src/modules/brand/domain/brand.entity.js';
import type {
  ConnectedAccountsRepository,
  MetaPageConnectionPayload,
} from '../../../../src/modules/connected-accounts/domain/ports/connected-accounts.repository.js';
import type { AccountVerifier } from '../../../../src/modules/connected-accounts/domain/ports/account-verifier.port.js';
import type { MetaOAuthClient } from '../../../../src/modules/connected-accounts/domain/ports/meta-oauth-client.port.js';
import type { MetaOAuthSessionsRepository } from '../../../../src/modules/connected-accounts/domain/ports/meta-oauth-sessions.repository.js';
import type { ConnectedAccount } from '../../../../src/modules/connected-accounts/domain/connected-account.entity.js';
import type {
  MetaOAuthSession,
  MetaPageAsset,
} from '../../../../src/modules/connected-accounts/domain/meta-oauth.entity.js';

const BASE_BRAND: Brand = {
  id: 'brand-1',
  name: 'Alma Quinta',
  logoUrl: null,
  websiteUrl: null,
  aiTone: 'Profesional y persuasivo',
  aiBrandVoice: null,
  aiTargetAudience: null,
  defaultHashtags: [],
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const BASE_ACCOUNT: ConnectedAccount = {
  id: 'account-1',
  brandId: BASE_BRAND.id,
  platform: 'LINKEDIN',
  status: 'CONNECTED',
  authType: 'MANUAL',
  metaPageId: null,
  accountName: 'almaquintaoficial',
  externalAccountId: 'urn:li:org:1',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const BASE_PAGE: MetaPageAsset = {
  id: 'page-1',
  name: 'Página E2E',
  accessToken: 'page-token-1',
  tasks: ['MANAGE'],
  instagram: { id: 'ig-1', username: 'ig_e2e' },
};

export function stubBrandsRepository(
  overrides: Partial<BrandsRepository> = {},
): BrandsRepository {
  return {
    findById: async () => BASE_BRAND,
    findAll: async () => [BASE_BRAND],
    create: async (data) => ({ ...BASE_BRAND, ...data }),
    update: async (id, data) => ({ ...BASE_BRAND, id, ...data }),
    delete: async () => {},
    ...overrides,
  };
}

export function stubConnectedAccountsRepository(
  overrides: Partial<ConnectedAccountsRepository> = {},
): ConnectedAccountsRepository {
  return {
    upsertAccount: async (brandId, payload) => ({ ...BASE_ACCOUNT, brandId, ...payload }),
    findAllByBrand: async () => [],
    findByBrandAndPlatform: async () => null,
    upsertMetaPage: async (brandId, payload: MetaPageConnectionPayload) => ({
      account: {
        ...BASE_ACCOUNT,
        brandId,
        platform: 'FACEBOOK',
        authType: 'META_OAUTH',
        metaPageId: payload.page.externalAccountId,
        accountName: payload.page.accountName,
        externalAccountId: payload.page.externalAccountId,
      },
      instagram: null,
    }),
    disconnectAccount: async () => true,
    markExpired: async () => {},
    getCredentialsForDispatch: async () => [],
    ...overrides,
  };
}

export function stubAccountVerifier(
  overrides: Partial<AccountVerifier> = {},
): AccountVerifier {
  return {
    verify: async () => ({ displayName: 'Alma Quinta' }),
    ...overrides,
  };
}

export function stubMetaOAuthSessionsRepository(
  overrides: Partial<MetaOAuthSessionsRepository> = {},
): MetaOAuthSessionsRepository {
  return {
    createSession: async (input) => ({
      id: 'session-1',
      brandId: input.brandId,
      userId: input.userId,
      status: 'PENDING',
      pages: null,
      errorCode: null,
      errorMessage: null,
      expiresAt: input.expiresAt,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      completedAt: null,
    }),
    findByStateHash: async () => null,
    getSession: async () => null,
    consumeState: async () => true,
    markReady: async () => {},
    markFailed: async () => {},
    completeSession: async () => {},
    invalidateActiveSessions: async () => {},
    deleteExpired: async () => {},
    ...overrides,
  };
}

export function metaSession(overrides: Partial<MetaOAuthSession> = {}): MetaOAuthSession {
  return {
    id: 'session-1',
    brandId: BASE_BRAND.id,
    userId: 'user-1',
    status: 'READY',
    pages: [BASE_PAGE],
    errorCode: null,
    errorMessage: null,
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    completedAt: null,
    ...overrides,
  };
}

export function stubMetaOAuthClient(
  overrides: Partial<MetaOAuthClient> = {},
): MetaOAuthClient {
  return {
    buildAuthorizationUrl: (state) =>
      `https://www.facebook.com/v25.0/dialog/oauth?state=${encodeURIComponent(state)}`,
    buildFrontendUrl: (path) => `http://localhost:3000${path}`,
    exchangeCodeForLongLivedUserToken: async () => 'long-lived-user-token',
    listPages: async () => [BASE_PAGE],
    debugPageToken: async () => ({
      isValid: true,
      expiresAt: null,
      scopes: ['pages_show_list'],
    }),
    getPageInstagram: async () => ({ id: 'ig-1', username: 'ig_e2e' }),
    ...overrides,
  };
}

export { BASE_ACCOUNT, BASE_BRAND, BASE_PAGE };
