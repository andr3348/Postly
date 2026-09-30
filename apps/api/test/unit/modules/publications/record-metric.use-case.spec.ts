import { TargetNotPublishedError } from '../../../../src/shared/errors.js';
import { RecordMetricUseCase } from '../../../../src/modules/publications/application/record-metric.use-case.js';
import {
  ADMIN,
  BASE_PUBLICATION,
  MARKETING,
  stubPublicationMetricsRepository,
  stubPublicationTargetsRepository,
  stubPublicationsRepository,
} from './test-stubs.js';

const SUCCESS_TARGET = {
  id: 'target-1',
  publicationId: BASE_PUBLICATION.id,
  platform: 'LINKEDIN' as const,
  status: 'SUCCESS' as const,
  externalPostId: 'urn:li:share:1',
  externalPostUrl: null,
  errorMessage: null,
  publishedAt: new Date('2026-01-02T00:00:00Z'),
  createdAt: new Date('2026-01-02T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
};

const PENDING_TARGET = { ...SUCCESS_TARGET, status: 'PENDING' as const };

describe('RecordMetricUseCase', () => {
  function arrange(target: typeof SUCCESS_TARGET | typeof PENDING_TARGET | null) {
    const publications = stubPublicationsRepository({
      findById: async () => BASE_PUBLICATION,
    });
    const targets = stubPublicationTargetsRepository({
      findByPublication: async () => (target === null ? [] : [target]),
    });
    return new RecordMetricUseCase(
      publications,
      targets,
      stubPublicationMetricsRepository(),
    );
  }

  it('records a snapshot on a published target', async () => {
    const metric = await arrange(SUCCESS_TARGET).execute({
      publicationId: BASE_PUBLICATION.id,
      platform: 'LINKEDIN',
      requester: ADMIN,
      snapshot: { impressions: 100, likes: 5 },
    });

    expect(metric).toMatchObject({ impressions: 100, likes: 5, comments: 0 });
  });

  it('rejects snapshots on an unpublished target', async () => {
    await expect(
      arrange(PENDING_TARGET).execute({
        publicationId: BASE_PUBLICATION.id,
        platform: 'LINKEDIN',
        requester: MARKETING,
        snapshot: { impressions: 100 },
      }),
    ).rejects.toBeInstanceOf(TargetNotPublishedError);
  });
});
