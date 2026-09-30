import {
  BrandNotFoundError,
  ConnectedAccountNotFoundError,
} from '../../../../src/shared/errors.js';
import { DisconnectAccountUseCase } from '../../../../src/modules/connected-accounts/application/disconnect-account.use-case.js';
import {
  BASE_BRAND,
  stubBrandsRepository,
  stubConnectedAccountsRepository,
} from './test-stubs.js';

describe('DisconnectAccountUseCase', () => {
  it('disconnects an attached account', async () => {
    const disconnected: string[] = [];
    const accounts = stubConnectedAccountsRepository({
      disconnectAccount: async (brandId, platform) => {
        disconnected.push(`${brandId}:${platform}`);
        return true;
      },
    });
    const useCase = new DisconnectAccountUseCase(accounts, stubBrandsRepository());

    await useCase.execute(BASE_BRAND.id, 'LINKEDIN');

    expect(disconnected).toEqual([`${BASE_BRAND.id}:LINKEDIN`]);
  });

  it('throws ConnectedAccountNotFoundError when not attached', async () => {
    const accounts = stubConnectedAccountsRepository({
      disconnectAccount: async () => false,
    });
    const useCase = new DisconnectAccountUseCase(accounts, stubBrandsRepository());

    await expect(useCase.execute(BASE_BRAND.id, 'TIKTOK')).rejects.toBeInstanceOf(
      ConnectedAccountNotFoundError,
    );
  });

  it('throws BrandNotFoundError for an unknown brand', async () => {
    const useCase = new DisconnectAccountUseCase(
      stubConnectedAccountsRepository(),
      stubBrandsRepository({ findById: async () => null }),
    );

    await expect(useCase.execute('missing', 'LINKEDIN')).rejects.toBeInstanceOf(
      BrandNotFoundError,
    );
  });
});
