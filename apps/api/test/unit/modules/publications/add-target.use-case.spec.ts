import {
  ForbiddenError,
  InvalidPublicationTransitionError,
  PublicationNotFoundError,
  PublicationTargetAlreadyAttachedError,
} from '../../../../src/shared/errors.js';
import { AddTargetUseCase } from '../../../../src/modules/publications/application/add-target.use-case.js';
import type { TargetPlatform } from '../../../../src/modules/publications/domain/target.entity.js';
import {
  ADMIN,
  BASE_PUBLICATION,
  MARKETING,
  OTHER_MARKETING,
  stubPublicationTargetsRepository,
  stubPublicationsRepository,
} from './test-stubs.js';

describe('AddTargetUseCase', () => {
  function arrange(status: typeof BASE_PUBLICATION.status, platforms: TargetPlatform[]) {
    const publications = stubPublicationsRepository({
      findById: async () => ({ ...BASE_PUBLICATION, status }),
    });
    const targets = stubPublicationTargetsRepository({
      findByPublication: async () =>
        platforms.map((platform, index) => ({
          id: `target-${index}`,
          publicationId: BASE_PUBLICATION.id,
          platform,
          status: 'PENDING' as const,
          externalPostId: null,
          externalPostUrl: null,
          errorMessage: null,
          publishedAt: null,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        })),
    });
    return new AddTargetUseCase(publications, targets);
  }

  it('attaches a channel to a DRAFT for the owner', async () => {
    const target = await arrange('DRAFT', []).execute({
      publicationId: BASE_PUBLICATION.id,
      platform: 'LINKEDIN',
      requester: MARKETING,
    });

    expect(target).toMatchObject({ platform: 'LINKEDIN', status: 'PENDING' });
  });

  it('rejects a duplicated channel with 409 semantics', async () => {
    await expect(
      arrange('DRAFT', ['LINKEDIN']).execute({
        publicationId: BASE_PUBLICATION.id,
        platform: 'LINKEDIN',
        requester: MARKETING,
      }),
    ).rejects.toBeInstanceOf(PublicationTargetAlreadyAttachedError);
  });

  it('rejects attaching to a SCHEDULED publication', async () => {
    await expect(
      arrange('SCHEDULED', []).execute({
        publicationId: BASE_PUBLICATION.id,
        platform: 'LINKEDIN',
        requester: ADMIN,
      }),
    ).rejects.toBeInstanceOf(InvalidPublicationTransitionError);
  });

  it('forbids a non-owner non-admin', async () => {
    await expect(
      arrange('DRAFT', []).execute({
        publicationId: BASE_PUBLICATION.id,
        platform: 'LINKEDIN',
        requester: OTHER_MARKETING,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('throws PublicationNotFoundError when missing', async () => {
    const publications = stubPublicationsRepository();
    const targets = stubPublicationTargetsRepository();

    await expect(
      new AddTargetUseCase(publications, targets).execute({
        publicationId: 'missing',
        platform: 'LINKEDIN',
        requester: MARKETING,
      }),
    ).rejects.toBeInstanceOf(PublicationNotFoundError);
  });
});
