import { BrandNotFoundError } from '../../../../src/shared/errors.js';
import { UpsertAccountUseCase } from '../../../../src/modules/connected-accounts/application/upsert-account.use-case.js';
import {
  BASE_ACCOUNT,
  BASE_BRAND,
  stubBrandsRepository,
  stubConnectedAccountsRepository,
} from './test-stubs.js';

describe('UpsertAccountUseCase', () => {
  const payload = {
    platform: 'LINKEDIN' as const,
    accountName: 'almaquintaoficial',
    externalAccountId: 'urn:li:org:1',
    accessToken: 'token',
  };

  it('upserts the account as CONNECTED for a fresh token', async () => {
    const useCase = new UpsertAccountUseCase(
      stubConnectedAccountsRepository(),
      stubBrandsRepository(),
    );

    const account = await useCase.execute({ ...payload, brandId: BASE_BRAND.id });

    expect(account).toMatchObject({ platform: 'LINKEDIN', status: 'CONNECTED' });
  });

  it('marks the account EXPIRED when the token is already expired', async () => {
    const seen: string[] = [];
    const accounts = stubConnectedAccountsRepository({
      upsertAccount: async (brandId, data) => {
        seen.push(data.status);
        return { ...BASE_ACCOUNT, brandId, ...data };
      },
    });
    const useCase = new UpsertAccountUseCase(accounts, stubBrandsRepository());

    await useCase.execute({
      ...payload,
      brandId: BASE_BRAND.id,
      expiresAt: new Date('2000-01-01T00:00:00Z'),
    });

    expect(seen).toEqual(['EXPIRED']);
  });

  it('throws BrandNotFoundError for an unknown brand', async () => {
    const useCase = new UpsertAccountUseCase(
      stubConnectedAccountsRepository(),
      stubBrandsRepository({ findById: async () => null }),
    );

    await expect(
      useCase.execute({ ...payload, brandId: 'missing' }),
    ).rejects.toBeInstanceOf(BrandNotFoundError);
  });
});
