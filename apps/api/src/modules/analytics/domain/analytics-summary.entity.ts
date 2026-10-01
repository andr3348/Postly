/**
 * Agregados para la pestaña Analytics. Solo lectura y derivados:
 * nada aquí se persiste (la tasa de engagement se calcula, no se guarda).
 */
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
