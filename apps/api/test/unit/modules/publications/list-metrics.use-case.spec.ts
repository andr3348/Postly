import { PublicationTargetNotFoundError } from '../../../../src/shared/errors.js';
import { ListMetricsUseCase } from '../../../../src/modules/publications/application/list-metrics.use-case.js';
import {
  BASE_PUBLICATION,
  stubPublicationMetricsRepository,
  stubPublicationTargetsRepository,
  stubPublicationsRepository,
} from './test-stubs.js';

describe('ListMetricsUseCase', () => {
  it('returns the target history', async () => {
    const publications = stubPublicationsRepository({
      findById: async () => BASE_PUBLICATION,
    });
    const targets = stubPublicationTargetsRepository({
      findByPublication: async () => [
        {
          id: 'target-1',
          publicationId: BASE_PUBLICATION.id,
          platform: 'LINKEDIN',
          status: 'SUCCESS',
          externalPostId: null,
          externalPostUrl: null,
          errorMessage: null,
          publishedAt: null,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        },
      ],
    });

    const history = await new ListMetricsUseCase(
      publications,
      targets,
      stubPublicationMetricsRepository(),
    ).execute({ publicationId: BASE_PUBLICATION.id, platform: 'LINKEDIN' });

    expect(history).toEqual([]);
  });

  it('throws PublicationTargetNotFoundError when the channel is not attached', async () => {
    const publications = stubPublicationsRepository({
      findById: async () => BASE_PUBLICATION,
    });

    await expect(
      new ListMetricsUseCase(
        publications,
        stubPublicationTargetsRepository(),
        stubPublicationMetricsRepository(),
      ).execute({ publicationId: BASE_PUBLICATION.id, platform: 'TIKTOK' }),
    ).rejects.toBeInstanceOf(PublicationTargetNotFoundError);
  });
});
