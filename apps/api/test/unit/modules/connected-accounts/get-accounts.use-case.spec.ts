import { BrandNotFoundError } from '../../../../src/shared/errors.js';
import { GetAccountsUseCase } from '../../../../src/modules/connected-accounts/application/get-accounts.use-case.js';
import {
  BASE_ACCOUNT,
  BASE_BRAND,
  stubBrandsRepository,
  stubConnectedAccountsRepository,
} from './test-stubs.js';

describe('GetAccountsUseCase', () => {
  it('returns the brand accounts without credentials', async () => {
    const accounts = stubConnectedAccountsRepository({
      findAllByBrand: async () => [BASE_ACCOUNT],
    });
    const useCase = new GetAccountsUseCase(accounts, stubBrandsRepository());

    const result = await useCase.execute(BASE_BRAND.id);

    expect(result).toEqual([BASE_ACCOUNT]);
    expect(result[0]).not.toHaveProperty('accessToken');
  });

  it('throws BrandNotFoundError for an unknown brand', async () => {
    const useCase = new GetAccountsUseCase(
      stubConnectedAccountsRepository(),
      stubBrandsRepository({ findById: async () => null }),
    );

    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(BrandNotFoundError);
  });
});
