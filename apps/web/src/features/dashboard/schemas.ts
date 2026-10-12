import { z } from 'zod';

/** Filtros de `GET /analytics/summary`. El backend siempre revalida. */
export const analyticsQuerySchema = z.object({
  brandId: z.string().min(1).max(100).optional(),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

export interface PlatformSummary {
  readonly platform: string;
  readonly targets: number;
  readonly impressions: number;
  readonly interactions: number;
  readonly engagementRate: number;
}

export interface AnalyticsSummary {
  readonly totalPublications: number;
  readonly byStatus: Record<string, number>;
  readonly totalImpressions: number;
  readonly totalInteractions: number;
  readonly engagementRate: number;
  readonly byPlatform: PlatformSummary[];
}
