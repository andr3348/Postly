import {
  ForbiddenError,
  InvalidPublicationTransitionError,
  InvalidTargetFormatError,
  PublicationNotFoundError,
  PublicationTargetNotFoundError,
} from '../../../../src/shared/errors.js';
import { UpdateTargetFormatUseCase } from '../../../../src/modules/publications/application/update-target-format.use-case.js';
import type { PublicationTarget } from '../../../../src/modules/publications/domain/target.entity.js';
import type { PublicationTargetsRepository } from '../../../../src/modules/publications/domain/ports/publication-targets.repository.js';
import {
  BASE_PUBLICATION,
  MARKETING,
  OTHER_MARKETING,
  stubPublicationTargetsRepository,
  stubPublicationsRepository,
} from './test-stubs.js';

const VIDEO_PUBLICATION = { ...BASE_PUBLICATION, mediaType: 'VIDEO' as const };

const FACEBOOK_TARGET: PublicationTarget = {
  id: 'target-1',
  publicationId: BASE_PUBLICATION.id,
  platform: 'FACEBOOK',
  format: 'REEL',
  status: 'PENDING',
  externalPostId: null,
  externalPostUrl: null,
  errorMessage: null,
  publishedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

function arrange(
  options: {
    publication?: typeof BASE_PUBLICATION | null;
    target?: PublicationTarget | null;
    updateFormat?: PublicationTargetsRepository['updateFormat'];
  } = {},
): UpdateTargetFormatUseCase {
  const publication =
    options.publication === undefined ? VIDEO_PUBLICATION : options.publication;
  const target = options.target === undefined ? FACEBOOK_TARGET : options.target;
  const publications = stubPublicationsRepository({
    findById: async () => publication,
  });
  const updateFormat =
    options.updateFormat ??
    (async (id, format) => ({ ...FACEBOOK_TARGET, id, format }));
  const targets = stubPublicationTargetsRepository({
    findByPublication: async () => (target === null ? [] : [target]),
    updateFormat,
  });
  return new UpdateTargetFormatUseCase(publications, targets);
}

const INPUT = {
  publicationId: BASE_PUBLICATION.id,
  platform: 'FACEBOOK' as const,
  format: 'FEED' as const,
  requester: MARKETING,
};

describe('UpdateTargetFormatUseCase', () => {
  it('changes the format of an attached channel', async () => {
    const calls: Array<{ id: string; format: string }> = [];
    const useCase = arrange({
      updateFormat: async (id, format) => {
        calls.push({ id, format });
        return { ...FACEBOOK_TARGET, id, format };
      },
    });

    const updated = await useCase.execute(INPUT);

    expect(updated.format).toBe('FEED');
    expect(calls).toEqual([{ id: FACEBOOK_TARGET.id, format: 'FEED' }]);
  });

  it('rejects REEL on an image publication', async () => {
    await expect(
      arrange({ publication: BASE_PUBLICATION }).execute({
        ...INPUT,
        format: 'REEL',
      }),
    ).rejects.toBeInstanceOf(InvalidTargetFormatError);
  });

  it('rejects REEL on a platform without Reels support', async () => {
    await expect(
      arrange({
        target: { ...FACEBOOK_TARGET, platform: 'LINKEDIN', format: 'FEED' },
      }).execute({
        ...INPUT,
        platform: 'LINKEDIN',
        format: 'REEL',
      }),
    ).rejects.toBeInstanceOf(InvalidTargetFormatError);
  });

  it('rejects editing after scheduling', async () => {
    await expect(
      arrange({
        publication: { ...VIDEO_PUBLICATION, status: 'SCHEDULED' },
      }).execute(INPUT),
    ).rejects.toBeInstanceOf(InvalidPublicationTransitionError);
  });

  it('forbids a non-owner non-admin', async () => {
    await expect(
      arrange().execute({ ...INPUT, requester: OTHER_MARKETING }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('throws PublicationTargetNotFoundError when the channel is missing', async () => {
    await expect(arrange({ target: null }).execute(INPUT)).rejects.toBeInstanceOf(
      PublicationTargetNotFoundError,
    );
  });

  it('throws PublicationNotFoundError when the publication is missing', async () => {
    await expect(arrange({ publication: null }).execute(INPUT)).rejects.toBeInstanceOf(
      PublicationNotFoundError,
    );
  });
});
