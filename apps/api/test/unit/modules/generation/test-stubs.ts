import type { Brand } from '../../../../src/modules/brand/domain/brand.entity.js';
import type { BrandsRepository } from '../../../../src/modules/brand/domain/ports/brands.repository.js';
import type {
  LlmTextGenerator,
  LlmTextGeneratorInput,
  LlmTextGeneratorResult,
} from '../../../../src/modules/generation/domain/ports/llm-text-generator.port.js';

export const BASE_BRAND: Brand = {
  id: 'brand-1',
  name: 'Alma Quinta',
  logoUrl: null,
  websiteUrl: 'https://almaquinta.test',
  aiTone: 'Profesional y cercano',
  aiBrandVoice: 'Experta, clara y sin exageraciones',
  aiTargetAudience: 'Pymes de Arequipa',
  defaultHashtags: ['#Marketing', '#Pymes'],
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

export function stubBrandsRepository(
  overrides: Partial<BrandsRepository> = {},
): BrandsRepository {
  return {
    findById: async () => BASE_BRAND,
    findAll: async () => [BASE_BRAND],
    create: async (data) => ({ ...BASE_BRAND, ...data }),
    update: async (id, data) => ({ ...BASE_BRAND, id, ...data }),
    delete: async () => {},
    ...overrides,
  };
}

export function stubLlmTextGenerator(
  text: string,
  overrides: Partial<LlmTextGeneratorResult> = {},
): LlmTextGenerator {
  return {
    generate: async (
      _input: LlmTextGeneratorInput,
    ): Promise<LlmTextGeneratorResult> => ({
      model: 'gemini-3.8-flash',
      text,
      tokensUsed: 123,
      ...overrides,
    }),
  };
}
