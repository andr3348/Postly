import { Inject, Injectable } from '@nestjs/common';
import {
  PUBLICATION_METRICS_REPOSITORY,
  type PublicationMetricsRepository,
} from '../../publications/domain/ports/publication-metrics.repository.js';
import {
  PUBLICATION_TARGETS_REPOSITORY,
  type PublicationTargetsRepository,
} from '../../publications/domain/ports/publication-targets.repository.js';
import {
  PUBLICATIONS_REPOSITORY,
  type PublicationsRepository,
} from '../../publications/domain/ports/publications.repository.js';
import type {
  AnalyticsSummary,
  PlatformSummary,
} from '../domain/analytics-summary.entity.js';

export interface AnalyticsFilters {
  readonly brandId?: string;
}

/**
 * Agregados del dashboard. Regla CLAVE: por destino solo cuenta su snapshot
 * más reciente (sumar el historial duplicaría impresiones).
 */
@Injectable()
export class GetAnalyticsSummaryUseCase {
  constructor(
    @Inject(PUBLICATIONS_REPOSITORY) private readonly publications: PublicationsRepository,
    @Inject(PUBLICATION_TARGETS_REPOSITORY) private readonly targets: PublicationTargetsRepository,
    @Inject(PUBLICATION_METRICS_REPOSITORY) private readonly metrics: PublicationMetricsRepository,
  ) {}

  async execute(filters: AnalyticsFilters): Promise<AnalyticsSummary> {
    const publications = await this.publications.findMany({
      brandId: filters.brandId,
    });
    const byStatus: Record<string, number> = {};
    const platforms = new Map<string, { targets: number; impressions: number; interactions: number }>();

    for (const publication of publications) {
      byStatus[publication.status] = (byStatus[publication.status] ?? 0) + 1;
      const targets = await this.targets.findByPublication(publication.id);
      for (const target of targets) {
        const history = await this.metrics.history(target.id);
        const latest = history[history.length - 1];
        if (latest === undefined) {
          continue;
        }
        const interactions = latest.likes + latest.comments + latest.shares;
        const entry = platforms.get(target.platform) ?? {
          targets: 0,
          impressions: 0,
          interactions: 0,
        };
        entry.targets += 1;
        entry.impressions += latest.impressions;
        entry.interactions += interactions;
        platforms.set(target.platform, entry);
      }
    }

    const byPlatform: PlatformSummary[] = [...platforms.entries()].map(
      ([platform, entry]) => ({
        platform,
        targets: entry.targets,
        impressions: entry.impressions,
        interactions: entry.interactions,
        engagementRate: rate(entry.interactions, entry.impressions),
      }),
    );
    const totalImpressions = byPlatform.reduce((sum, entry) => sum + entry.impressions, 0);
    const totalInteractions = byPlatform.reduce((sum, entry) => sum + entry.interactions, 0);

    return {
      totalPublications: publications.length,
      byStatus,
      totalImpressions,
      totalInteractions,
      engagementRate: rate(totalInteractions, totalImpressions),
      byPlatform,
    };
  }
}

function rate(interactions: number, impressions: number): number {
  if (impressions <= 0) {
    return 0;
  }
  return Number(((interactions / impressions) * 100).toFixed(2));
}
