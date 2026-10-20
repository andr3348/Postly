import { BrandNotFoundError } from '../../../../src/shared/errors.js';
import { CreatePublicationUseCase } from '../../../../src/modules/publications/application/create-publication.use-case.js';
import {
  stubBrandsRepository,
  stubPublicationsRepository,
} from './test-stubs.js';

describe('CreatePublicationUseCase', () => {
  it('creates the publication in DRAFT', async () => {
    const useCase = new CreatePublicationUseCase(
      stubPublicationsRepository(),
      stubBrandsRepository(),
    );

    const publication = await useCase.execute({
      brandId: 'brand-1',
      userId: 'user-1',
      copy: 'copy',
      mediaUrl: 'https://postly.test/m.jpg',
      modelText: 'gemini-3.5-flash-lite',
    });

    expect(publication).toMatchObject({
      status: 'DRAFT',
      brandId: 'brand-1',
      modelText: 'gemini-3.5-flash-lite',
    });
  });

  it('throws BrandNotFoundError for an unknown brand', async () => {
    const useCase = new CreatePublicationUseCase(
      stubPublicationsRepository(),
      stubBrandsRepository({ findById: async () => null }),
    );

    await expect(
      useCase.execute({
        brandId: 'missing',
        userId: 'user-1',
        copy: 'copy',
        mediaUrl: 'https://postly.test/m.jpg',
      }),
    ).rejects.toBeInstanceOf(BrandNotFoundError);
  });
});
