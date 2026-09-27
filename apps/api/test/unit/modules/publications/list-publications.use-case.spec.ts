import { ListPublicationsUseCase } from '../../../../src/modules/publications/application/list-publications.use-case.js';
import { BASE_PUBLICATION, stubPublicationsRepository } from './test-stubs.js';

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
