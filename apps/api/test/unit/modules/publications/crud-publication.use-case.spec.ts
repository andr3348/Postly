import { BrandNotFoundError } from '../../../../src/shared/errors.js';
import { CreatePublicationUseCase } from '../../../../src/modules/publications/application/create-publication.use-case.js';
import {
  GetPublicationUseCase,
  ListPublicationsUseCase,
} from '../../../../src/modules/publications/application/query-publication.use-case.js';
import { PublicationNotFoundError } from '../../../../src/shared/errors.js';
import {
  BASE_PUBLICATION,
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
    });

    expect(publication).toMatchObject({ status: 'DRAFT', brandId: 'brand-1' });
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

describe('GetPublicationUseCase', () => {
  it('throws PublicationNotFoundError when missing', async () => {
    const useCase = new GetPublicationUseCase(stubPublicationsRepository());

    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(
      PublicationNotFoundError,
    );
  });
});

describe('ListPublicationsUseCase', () => {
  it('returns the filtered publications', async () => {
    const useCase = new ListPublicationsUseCase(
      stubPublicationsRepository({ findMany: async () => [BASE_PUBLICATION] }),
    );

    await expect(useCase.execute({ brandId: 'brand-1' })).resolves.toEqual([
      BASE_PUBLICATION,
    ]);
  });
});
