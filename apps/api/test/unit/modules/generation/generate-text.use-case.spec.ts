import { BrandNotFoundError } from '../../../../src/shared/errors.js';
import { GenerateTextUseCase } from '../../../../src/modules/generation/application/generate-text.use-case.js';
import { stubBrandsRepository, stubLlmTextGenerator } from './test-stubs.js';

const IDEAS_JSON = JSON.stringify({
  ideas: [
    {
      title: 'Idea',
      angle: 'Ángulo',
      hook: 'Hook',
      whyItWorks: 'Funciona',
      suggestedFormat: 'FEED',
    },
  ],
});

describe('GenerateTextUseCase', () => {
  it('devuelve ideas validadas y metadatos del modelo', async () => {
    const useCase = new GenerateTextUseCase(
      stubBrandsRepository(),
      stubLlmTextGenerator(IDEAS_JSON),
    );

    const result = await useCase.execute({
      brandId: 'brand-1',
      mode: 'IDEAS',
      prompt: 'Curso de marketing',
    });

    expect(result).toMatchObject({
      model: 'gemini-3.8-flash',
      tokensUsed: 123,
    });
    expect(result.ideas).toHaveLength(1);
    expect(result.variants).toEqual([]);
  });

  it('lanza BrandNotFoundError si la marca no existe', async () => {
    const useCase = new GenerateTextUseCase(
      stubBrandsRepository({ findById: async () => null }),
      stubLlmTextGenerator(IDEAS_JSON),
    );

    await expect(
      useCase.execute({ brandId: 'missing', mode: 'IDEAS', prompt: 'Brief' }),
    ).rejects.toBeInstanceOf(BrandNotFoundError);
  });
});
