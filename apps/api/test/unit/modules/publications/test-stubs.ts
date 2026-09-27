import type { Brand } from '../../../../src/modules/brand/domain/brand.entity.js';
import type { BrandsRepository } from '../../../../src/modules/brand/domain/ports/brands.repository.js';
import type { Publication } from '../../../../src/modules/publications/domain/publication.entity.js';
import type { PublicationTarget } from '../../../../src/modules/publications/domain/target.entity.js';
import type { PublicationsRepository } from '../../../../src/modules/publications/domain/ports/publications.repository.js';
import type { PublicationTargetsRepository } from '../../../../src/modules/publications/domain/ports/publication-targets.repository.js';

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

const BASE_PUBLICATION: Publication = {
  id: 'pub-1',
  brandId: BASE_BRAND.id,
  userId: 'user-1',
  approvedById: null,
  approvedAt: null,
  originalPrompt: 'prompt',
  systemPrompt: null,
  modelText: 'gemini-1.5-flash',
  modelMedia: null,
  tokensUsed: null,
  copy: 'copy',
  mediaUrl: 'https://postly.test/m.jpg',
  mediaType: 'IMAGE',
  status: 'DRAFT',
  scheduledAt: null,
  dispatchedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

export const MARKETING = { id: 'user-1', role: 'MARKETING' };
export const OTHER_MARKETING = { id: 'user-2', role: 'MARKETING' };
export const ADMIN = { id: 'admin-1', role: 'ADMIN' };

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

export function stubPublicationsRepository(
  overrides: Partial<PublicationsRepository> = {},
): PublicationsRepository {
  return {
    findById: async () => null,
    findMany: async () => [],
    create: async (data) => ({ ...BASE_PUBLICATION, ...data }),
    update: async (id, data) => ({ ...BASE_PUBLICATION, id, ...data }),
    ...overrides,
  };
}

export function stubPublicationTargetsRepository(
  overrides: Partial<PublicationTargetsRepository> = {},
): PublicationTargetsRepository {
  return {
    findByPublication: async () => [],
    add: async (publicationId, platform) => ({
      id: 'target-1',
      publicationId,
      platform,
      status: 'PENDING',
      externalPostId: null,
      externalPostUrl: null,
      errorMessage: null,
      publishedAt: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    }),
    remove: async () => true,
    ...overrides,
  };
}

export { BASE_BRAND, BASE_PUBLICATION };
