import { PublicationNotFoundError } from '../../../../src/shared/errors.js';
import { GetPublicationUseCase } from '../../../../src/modules/publications/application/get-publication.use-case.js';
import { stubPublicationsRepository } from './test-stubs.js';

describe('GetPublicationUseCase', () => {
  it('throws PublicationNotFoundError when missing', async () => {
    const useCase = new GetPublicationUseCase(stubPublicationsRepository());

    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(
      PublicationNotFoundError,
    );
  });
});
