import {
  ForbiddenError,
  InvalidPublicationTransitionError,
  PublicationNotFoundError,
  PublicationWithoutTargetsError,
} from '../../../../src/shared/errors.js';
import { SubmitPublicationUseCase } from '../../../../src/modules/publications/application/submit-publication.use-case.js';
import {
  BASE_PUBLICATION,
  MARKETING,
  OTHER_MARKETING,
  stubPublicationsRepository,
  stubPublicationTargetsRepository,
} from './test-stubs.js';

const PENDING = { ...BASE_PUBLICATION, status: 'PENDING_APPROVAL' as const };

const LINKEDIN_TARGET = {
  id: 'target-1',
  publicationId: BASE_PUBLICATION.id,
  platform: 'LINKEDIN' as const,
  status: 'PENDING' as const,
  externalPostId: null,
  externalPostUrl: null,
  errorMessage: null,
  publishedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

function submitWithTargets(
  publications: ReturnType<typeof stubPublicationsRepository>,
): SubmitPublicationUseCase {
  const targets = stubPublicationTargetsRepository({
    findByPublication: async () => [LINKEDIN_TARGET],
  });
  return new SubmitPublicationUseCase(publications, targets);
}

describe('SubmitPublicationUseCase', () => {
  it('moves DRAFT to PENDING_APPROVAL for the owner', async () => {
    const updated: string[] = [];
    const publications = stubPublicationsRepository({
      findById: async () => BASE_PUBLICATION,
      update: async (id, data) => {
        updated.push(JSON.stringify(data));
        return { ...BASE_PUBLICATION, id, ...data };
      },
    });

    const publication = await submitWithTargets(publications).execute({
      id: BASE_PUBLICATION.id,
      requester: MARKETING,
    });

    expect(publication.status).toBe('PENDING_APPROVAL');
    expect(updated).toHaveLength(1);
  });

  it('forbids a non-owner non-admin', async () => {
    const publications = stubPublicationsRepository({
      findById: async () => BASE_PUBLICATION,
    });

    await expect(
      submitWithTargets(publications).execute({
        id: BASE_PUBLICATION.id,
        requester: OTHER_MARKETING,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('rejects submit from a non-DRAFT status', async () => {
    const publications = stubPublicationsRepository({
      findById: async () => PENDING,
    });

    await expect(
      submitWithTargets(publications).execute({
        id: PENDING.id,
        requester: MARKETING,
      }),
    ).rejects.toBeInstanceOf(InvalidPublicationTransitionError);
  });

  it('throws PublicationNotFoundError when missing', async () => {
    await expect(
      new SubmitPublicationUseCase(
        stubPublicationsRepository(),
        stubPublicationTargetsRepository(),
      ).execute({
        id: 'missing',
        requester: MARKETING,
      }),
    ).rejects.toBeInstanceOf(PublicationNotFoundError);
  });

  it('rejects submit without targets', async () => {
    const publications = stubPublicationsRepository({
      findById: async () => BASE_PUBLICATION,
    });

    await expect(
      new SubmitPublicationUseCase(
        publications,
        stubPublicationTargetsRepository(),
      ).execute({
        id: BASE_PUBLICATION.id,
        requester: MARKETING,
      }),
    ).rejects.toBeInstanceOf(PublicationWithoutTargetsError);
  });
});
