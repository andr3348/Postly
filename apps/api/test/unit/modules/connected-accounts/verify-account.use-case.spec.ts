import { BrandNotFoundError, InvalidAccountCredentialsError } from '../../../../src/shared/errors.js';
import { VerifyAccountUseCase } from '../../../../src/modules/connected-accounts/application/verify-account.use-case.js';
import {
  BASE_BRAND,
  stubAccountVerifier,
  stubBrandsRepository,
} from './test-stubs.js';

describe('VerifyAccountUseCase', () => {
  const input = {
    platform: 'FACEBOOK' as const,
    externalAccountId: '123456',
    accessToken: 'token',
  };

  it('returns valid + displayName without persisting', async () => {
    const useCase = new VerifyAccountUseCase(
      stubAccountVerifier(),
      stubBrandsRepository(),
    );

    const result = await useCase.execute(BASE_BRAND.id, input);

    expect(result).toEqual({ valid: true, displayName: 'Alma Quinta' });
  });

  it('throws BrandNotFoundError for an unknown brand', async () => {
    const useCase = new VerifyAccountUseCase(
      stubAccountVerifier(),
      stubBrandsRepository({ findById: async () => null }),
    );

    await expect(useCase.execute('missing', input)).rejects.toBeInstanceOf(BrandNotFoundError);
  });

  it('propagates provider rejection as InvalidAccountCredentialsError', async () => {
    const useCase = new VerifyAccountUseCase(
      stubAccountVerifier({
        verify: async () => {
          throw new InvalidAccountCredentialsError('FACEBOOK', 'Invalid OAuth access token');
        },
      }),
      stubBrandsRepository(),
    );

    await expect(useCase.execute(BASE_BRAND.id, input)).rejects.toBeInstanceOf(
      InvalidAccountCredentialsError,
    );
  });
});
