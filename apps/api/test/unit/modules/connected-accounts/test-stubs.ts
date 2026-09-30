import type { BrandsRepository } from '../../../../src/modules/brand/domain/ports/brands.repository.js';
import type { Brand } from '../../../../src/modules/brand/domain/brand.entity.js';
import type { ConnectedAccountsRepository } from '../../../../src/modules/connected-accounts/domain/ports/connected-accounts.repository.js';
import type { ConnectedAccount } from '../../../../src/modules/connected-accounts/domain/connected-account.entity.js';

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
  accountName: 'almaquintaoficial',
  externalAccountId: 'urn:li:org:1',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
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
    disconnectAccount: async () => true,
    getCredentialsForDispatch: async () => [],
    ...overrides,
  };
}

export { BASE_ACCOUNT, BASE_BRAND };
