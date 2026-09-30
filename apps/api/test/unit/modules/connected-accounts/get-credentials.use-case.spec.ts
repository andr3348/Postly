import { MissingConnectedAccountError } from '../../../../src/shared/errors.js';
import { GetCredentialsUseCase } from '../../../../src/modules/connected-accounts/application/get-credentials.use-case.js';
import { BASE_BRAND, stubConnectedAccountsRepository } from './test-stubs.js';

describe('GetCredentialsUseCase', () => {
  it('throws MissingConnectedAccountError when a platform is not connected', async () => {
    const useCase = new GetCredentialsUseCase(stubConnectedAccountsRepository());

    await expect(
      useCase.execute(BASE_BRAND.id, ['LINKEDIN']),
    ).rejects.toBeInstanceOf(MissingConnectedAccountError);
  });
});
