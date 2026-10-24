import { GenerateAgentUseCase } from '../../../../src/modules/generation/application/generate-agent.use-case.js';
import { GenerateTextUseCase } from '../../../../src/modules/generation/application/generate-text.use-case.js';
import type { MediaGenerator } from '../../../../src/modules/generation/domain/ports/media-generator.port.js';
import type { MediaStorage } from '../../../../src/modules/generation/domain/ports/media-storage.port.js';
import { CreatePublicationUseCase } from '../../../../src/modules/publications/application/create-publication.use-case.js';
import {
  stubBrandsRepository as stubPublicationBrands,
  stubPublicationsRepository,
} from '../publications/test-stubs.js';
import {
  stubBrandsRepository as stubGenerationBrands,
  stubLlmTextGenerator,
} from './test-stubs.js';

const VARIANT = {
  title: 'Lanzamiento',
  copy: 'Copy del lanzamiento',
  hashtags: ['Marketing', '#Pymes'],
  cta: 'Agenda tu llamada',
  mediaPrompt: 'Video del lanzamiento',
  altText: 'Equipo celebrando',
};

function variantsText(variant: Record<string, string | string[]>): string {
  return JSON.stringify({ variants: [variant] });
}

function buildUseCase(variant = VARIANT) {
  const generateText = new GenerateTextUseCase(
    stubGenerationBrands(),
    stubLlmTextGenerator(variantsText(variant)),
  );
  const generate = vi.fn().mockResolvedValue({
    url: 'https://fal.test/media.mp4',
    model: 'fal-ai/kling-video/v3/turbo/standard/text-to-video',
    contentType: 'video/mp4',
  });
  const uploadFromUrl = vi
    .fn()
    .mockResolvedValue('https://cdn.test/publications/media.mp4');
  const useCase = new GenerateAgentUseCase(
    generateText,
    { generate } as MediaGenerator,
    { uploadFromUrl } as MediaStorage,
    new CreatePublicationUseCase(
      stubPublicationsRepository(),
      stubPublicationBrands(),
    ),
  );

  return { useCase, generate, uploadFromUrl };
}

describe('GenerateAgentUseCase', () => {
  it('genera texto y video, copia la media a R2 y crea el borrador', async () => {
    const { useCase, generate, uploadFromUrl } = buildUseCase();

    const publication = await useCase.execute({
      requesterId: 'user-1',
      brandId: 'brand-1',
      prompt: 'Lanzamiento de primavera',
      platform: 'INSTAGRAM',
      format: 'REEL',
    });

    expect(generate).toHaveBeenCalledWith({
      prompt: 'Video del lanzamiento',
      mediaType: 'VIDEO',
      aspectRatio: '9:16',
    });
    expect(uploadFromUrl).toHaveBeenCalledWith({
      sourceUrl: 'https://fal.test/media.mp4',
      contentType: 'video/mp4',
      key: expect.stringMatching(/^publications\/[0-9a-f-]{36}\.mp4$/),
    });
    expect(publication).toMatchObject({
      status: 'DRAFT',
      brandId: 'brand-1',
      title: 'Lanzamiento',
      copy: 'Copy del lanzamiento\n\n#Marketing #Pymes',
      mediaUrl: 'https://cdn.test/publications/media.mp4',
      mediaType: 'VIDEO',
      modelText: 'gemini-3.8-flash',
      modelMedia: 'fal-ai/kling-video/v3/turbo/standard/text-to-video',
      tokensUsed: 123,
    });
  });

  it('en FEED usa imagen 1:1 y cae al copy si falta mediaPrompt', async () => {
    const { useCase, generate } = buildUseCase({
      ...VARIANT,
      mediaPrompt: '',
    });

    await useCase.execute({
      requesterId: 'user-1',
      brandId: 'brand-1',
      prompt: 'Post de feed',
      platform: 'LINKEDIN',
      format: 'FEED',
    });

    expect(generate).toHaveBeenCalledWith({
      prompt: 'Copy del lanzamiento',
      mediaType: 'IMAGE',
      aspectRatio: '1:1',
    });
  });

  it('respeta un mediaType explícito (VIDEO en FEED)', async () => {
    const { useCase, generate } = buildUseCase();

    await useCase.execute({
      requesterId: 'user-1',
      brandId: 'brand-1',
      prompt: 'Post de feed',
      platform: 'FACEBOOK',
      format: 'FEED',
      mediaType: 'VIDEO',
    });

    expect(generate).toHaveBeenCalledWith({
      prompt: 'Video del lanzamiento',
      mediaType: 'VIDEO',
      aspectRatio: '1:1',
    });
  });

  it('falla con GEMINI_INVALID_RESPONSE cuando el texto no trae variantes', async () => {
    const generateText = {
      execute: async () => ({
        model: 'gemini-3.8-flash',
        tokensUsed: null,
        ideas: [],
        variants: [],
      }),
    } as unknown as GenerateTextUseCase;
    const generate = vi.fn();
    const uploadFromUrl = vi.fn();
    const useCase = new GenerateAgentUseCase(
      generateText,
      { generate } as unknown as MediaGenerator,
      { uploadFromUrl } as unknown as MediaStorage,
      {} as CreatePublicationUseCase,
    );

    await expect(
      useCase.execute({
        requesterId: 'user-1',
        brandId: 'brand-1',
        prompt: 'Brief',
        platform: 'FACEBOOK',
        format: 'FEED',
      }),
    ).rejects.toMatchObject({
      code: 'GEMINI_INVALID_RESPONSE',
      retryable: true,
    });
    expect(generate).not.toHaveBeenCalled();
    expect(uploadFromUrl).not.toHaveBeenCalled();
  });
});
