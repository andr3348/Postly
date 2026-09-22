import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service.js';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummaryMetrics() {
    // Total de posts creados y publicados
    const totalPosts = await this.prisma.client.publication.count();
    const publishedPosts = await this.prisma.client.publication.count({
      where: { status: 'PUBLISHED' },
    });

    // Sumatoria total de métricas consolidadas
    const aggregates = await this.prisma.client.targetMetric.aggregate({
      _sum: {
        impressions: true,
        likes: true,
        comments: true,
        shares: true,
        clicks: true,
      },
    });

    const impressions = aggregates._sum.impressions ?? 0;
    const interactions =
      (aggregates._sum.likes ?? 0) +
      (aggregates._sum.comments ?? 0) +
      (aggregates._sum.shares ?? 0);

    // Engagement Rate: (Interacciones / Impresiones) * 100
    const engagementRate =
      impressions > 0
        ? Number(((interactions / impressions) * 100).toFixed(2))
        : 0;

    return {
      kpis: {
        totalPosts,
        publishedPosts,
        totalImpressions: impressions,
        totalInteractions: interactions,
        engagementRate,
      },
    };
  }

  async getPlatformPerformance(): Promise<
    {
      platform: string;
      metrics: { impressions: number; likes: number; clicks: number }[];
    }[]
  > {
    // Agrupar métricas por plataforma (Facebook, LinkedIn, etc.)
    return this.prisma.client.publicationTarget.findMany({
      select: {
        platform: true,
        metrics: {
          orderBy: { capturedAt: 'desc' },
          take: 1,
          select: { impressions: true, likes: true, clicks: true },
        },
      },
    });
  }
}
