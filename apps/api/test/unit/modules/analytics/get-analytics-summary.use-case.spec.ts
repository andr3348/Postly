import { GetAnalyticsSummaryUseCase } from '../../../../src/modules/analytics/application/get-analytics-summary.use-case.js';
import type { TargetMetric } from '../../../../src/modules/publications/domain/metric.entity.js';
import {
  BASE_PUBLICATION,
  stubPublicationMetricsRepository,
  stubPublicationTargetsRepository,
  stubPublicationsRepository,
} from '../publications/test-stubs.js';

function metric(impressions: number, likes: number): TargetMetric {
  return {
    id: `metric-${impressions}`,
    publicationTargetId: 'target-1',
    impressions,
    likes,
    comments: 0,
    shares: 0,
    clicks: 0,
    capturedAt: new Date('2026-01-02T00:00:00Z'),
  };
}

function target(id: string) {
  return {
    id,
    publicationId: BASE_PUBLICATION.id,
    platform: 'LINKEDIN' as const,
    status: 'SUCCESS' as const,
    externalPostId: null,
    externalPostUrl: null,
    errorMessage: null,
    publishedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
}

describe('GetAnalyticsSummaryUseCase', () => {
  it('counts only the latest snapshot per target', async () => {
    const publications = stubPublicationsRepository({
      findMany: async () => [{ ...BASE_PUBLICATION, status: 'PUBLISHED' as const }],
    });
    const targets = stubPublicationTargetsRepository({
      findByPublication: async () => [target('target-1')],
    });
    const metrics = stubPublicationMetricsRepository({
      history: async () => [metric(100, 5), metric(1000, 50)],
    });

    const summary = await new GetAnalyticsSummaryUseCase(
      publications,
      targets,
      metrics,
    ).execute({});

    expect(summary.totalPublications).toBe(1);
    expect(summary.byStatus).toEqual({ PUBLISHED: 1 });
    expect(summary.totalImpressions).toBe(1000);
    // (50/1000)*100, no (55/1100)*100.
    expect(summary.engagementRate).toBe(5);
    expect(summary.byPlatform).toHaveLength(1);
  });

  it('returns zeros without division errors when empty', async () => {
    const summary = await new GetAnalyticsSummaryUseCase(
      stubPublicationsRepository({ findMany: async () => [] }),
      stubPublicationTargetsRepository(),
      stubPublicationMetricsRepository(),
    ).execute({});

    expect(summary).toMatchObject({
      totalPublications: 0,
      totalImpressions: 0,
      engagementRate: 0,
      byPlatform: [],
    });
  });
});
