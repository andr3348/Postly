import { BrandNotFoundError } from '../../../../src/shared/errors.js';
import { CreateBrandUseCase } from '../../../../src/modules/brand/application/create-brand.use-case.js';
import { DeleteBrandUseCase } from '../../../../src/modules/brand/application/delete-brand.use-case.js';
import { GetBrandUseCase } from '../../../../src/modules/brand/application/get-brand.use-case.js';
import { GetBrandsUseCase } from '../../../../src/modules/brand/application/get-brands.use-case.js';
import { UpdateBrandUseCase } from '../../../../src/modules/brand/application/update-brand.use-case.js';
import { BASE_BRAND, stubBrandsRepository } from './test-stubs.js';

describe('CreateBrandUseCase', () => {
  it('creates the brand with the given data', async () => {
    const useCase = new CreateBrandUseCase(stubBrandsRepository());

    const brand = await useCase.execute({ name: 'Nueva Marca' });

    expect(brand).toMatchObject({ name: 'Nueva Marca' });
  });
});

describe('GetBrandsUseCase', () => {
  it('returns all brands', async () => {
    const useCase = new GetBrandsUseCase(
      stubBrandsRepository({ findAll: async () => [BASE_BRAND] }),
    );

    await expect(useCase.execute()).resolves.toEqual([BASE_BRAND]);
  });
});

describe('GetBrandUseCase', () => {
  it('returns the brand when it exists', async () => {
    const useCase = new GetBrandUseCase(
      stubBrandsRepository({ findById: async () => BASE_BRAND }),
    );

    await expect(useCase.execute(BASE_BRAND.id)).resolves.toEqual(BASE_BRAND);
  });

  it('throws BrandNotFoundError when it does not exist', async () => {
    const useCase = new GetBrandUseCase(stubBrandsRepository());

    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(BrandNotFoundError);
  });
});

describe('DeleteBrandUseCase', () => {  it('deletes the brand when it exists', async () => {
    const deleted: string[] = [];
    const brands = stubBrandsRepository({
      findById: async () => BASE_BRAND,
      delete: async (id) => {
        deleted.push(id);
      },
    });

    await new DeleteBrandUseCase(brands).execute(BASE_BRAND.id);

    expect(deleted).toEqual([BASE_BRAND.id]);
  });

  it('throws BrandNotFoundError when it does not exist', async () => {
    const useCase = new DeleteBrandUseCase(stubBrandsRepository());

    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(BrandNotFoundError);
  });
});

describe('UpdateBrandUseCase', () => {
  it('updates the brand when it exists', async () => {
    const brands = stubBrandsRepository({ findById: async () => BASE_BRAND });

    const brand = await new UpdateBrandUseCase(brands).execute({
      id: BASE_BRAND.id,
      name: 'Renombrada',
    });

    expect(brand).toMatchObject({ id: BASE_BRAND.id, name: 'Renombrada' });
  });

  it('throws BrandNotFoundError when it does not exist', async () => {
    const useCase = new UpdateBrandUseCase(stubBrandsRepository());

    await expect(
      useCase.execute({ id: 'missing', name: 'X' }),
    ).rejects.toBeInstanceOf(BrandNotFoundError);
  });
});
