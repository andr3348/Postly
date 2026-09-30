import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type { MetricSnapshot, TargetMetric } from '../domain/metric.entity.js';
import type { PublicationMetricsRepository } from '../domain/ports/publication-metrics.repository.js';

/** Adaptador Prisma de `PublicationMetricsRepository`. */
@Injectable()
export class PrismaPublicationMetricsRepository implements PublicationMetricsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(targetId: string, snapshot: MetricSnapshot): Promise<TargetMetric> {
    const row = await this.prisma.client.targetMetric.create({
      data: {
        publicationTargetId: targetId,
        impressions: snapshot.impressions ?? 0,
        likes: snapshot.likes ?? 0,
        comments: snapshot.comments ?? 0,
        shares: snapshot.shares ?? 0,
        clicks: snapshot.clicks ?? 0,
      },
    });
    return toDomainMetric(row);
  }

  async history(targetId: string): Promise<TargetMetric[]> {
    const rows = await this.prisma.client.targetMetric.findMany({
      where: { publicationTargetId: targetId },
      orderBy: { capturedAt: 'asc' },
    });
    return rows.map(toDomainMetric);
  }
}

interface MetricRow {
  readonly id: string;
  readonly publicationTargetId: string;
  readonly impressions: number;
  readonly likes: number;
  readonly comments: number;
  readonly shares: number;
  readonly clicks: number;
  readonly capturedAt: Date;
}

function toDomainMetric(row: MetricRow): TargetMetric {
  return {
    id: row.id,
    publicationTargetId: row.publicationTargetId,
    impressions: row.impressions,
    likes: row.likes,
    comments: row.comments,
    shares: row.shares,
    clicks: row.clicks,
    capturedAt: row.capturedAt,
  };
}
