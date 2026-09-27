import type { Brand } from '../../../../src/modules/brand/domain/brand.entity.js';
import type { BrandsRepository } from '../../../../src/modules/brand/domain/ports/brands.repository.js';

const BASE_BRAND: Brand = {
  id: 'brand-1',
  name: 'Alma Quinta',
  logoUrl: null,
  websiteUrl: null,
  aiTone: 'Profesional y persuasivo',
  aiBrandVoice: null,
  aiTargetAudience: null,
  defaultHashtags: [],
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

export function stubBrandsRepository(
  overrides: Partial<BrandsRepository> = {},
): BrandsRepository {
  return {
    findById: async () => null,
    findAll: async () => [],
    create: async (data) => ({ ...BASE_BRAND, ...data }),
    update: async (id, data) => ({ ...BASE_BRAND, id, ...data }),
    delete: async () => {},
    ...overrides,
  };
}

export { BASE_BRAND };
