import {
  InvalidPublicationTransitionError,
  InvalidTargetFormatError,
} from '../../../../src/shared/errors.js';
import { UpdateDraftUseCase } from '../../../../src/modules/publications/application/update-draft.use-case.js';
import type { PublicationTarget } from '../../../../src/modules/publications/domain/target.entity.js';
import {
  BASE_PUBLICATION,
  MARKETING,
  stubPublicationTargetsRepository,
  stubPublicationsRepository,
} from './test-stubs.js';

const PENDING = { ...BASE_PUBLICATION, status: 'PENDING_APPROVAL' as const };

const REEL_TARGET: PublicationTarget = {
  id: 'target-1',
  publicationId: BASE_PUBLICATION.id,
  platform: 'FACEBOOK',
  format: 'REEL',
  status: 'PENDING',
  externalPostId: null,
  externalPostUrl: null,
  errorMessage: null,
  failure: null,
  retryCount: 0,
  publishedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

describe('UpdateDraftUseCase', () => {
  it('edits content while DRAFT', async () => {
    const publications = stubPublicationsRepository({
      findById: async () => BASE_PUBLICATION,
    });

    const publication = await new UpdateDraftUseCase(
      publications,
      stubPublicationTargetsRepository(),
    ).execute({
      id: BASE_PUBLICATION.id,
      requester: MARKETING,
      copy: 'editado',
    });

    expect(publication.copy).toBe('editado');
  });

  it('rejects editing a non-DRAFT publication', async () => {
    const publications = stubPublicationsRepository({
      findById: async () => PENDING,
    });

    await expect(
      new UpdateDraftUseCase(publications, stubPublicationTargetsRepository()).execute({
        id: PENDING.id,
        requester: MARKETING,
        copy: 'x',
      }),
    ).rejects.toBeInstanceOf(InvalidPublicationTransitionError);
  });

  it('rejects changing to IMAGE while REEL targets are attached', async () => {
    const publications = stubPublicationsRepository({
      findById: async () => ({ ...BASE_PUBLICATION, mediaType: 'VIDEO' }),
    });
    const targets = stubPublicationTargetsRepository({
      findByPublication: async () => [REEL_TARGET],
    });

    await expect(
      new UpdateDraftUseCase(publications, targets).execute({
        id: BASE_PUBLICATION.id,
        requester: MARKETING,
        mediaType: 'IMAGE',
      }),
    ).rejects.toBeInstanceOf(InvalidTargetFormatError);
  });

  it('allows changing to IMAGE when targets are FEED', async () => {
    const publications = stubPublicationsRepository({
      findById: async () => ({ ...BASE_PUBLICATION, mediaType: 'VIDEO' }),
    });
    const targets = stubPublicationTargetsRepository({
      findByPublication: async () => [{ ...REEL_TARGET, format: 'FEED' }],
    });

    const publication = await new UpdateDraftUseCase(publications, targets).execute({
      id: BASE_PUBLICATION.id,
      requester: MARKETING,
      mediaType: 'IMAGE',
    });

    expect(publication.mediaType).toBe('IMAGE');
  });
});
