/**
 * Snapshot de métricas de un destino (entidad hija, sin módulo propio:
 * vive anidada bajo `/publications/:id/targets/:platform/metrics`).
 * La tasa de engagement se calcula, nunca se almacena.
 */
export interface TargetMetric {
  readonly id: string;
  readonly publicationTargetId: string;
  readonly impressions: number;
  readonly likes: number;
  readonly comments: number;
  readonly shares: number;
  readonly clicks: number;
  readonly capturedAt: Date;
}

export interface MetricSnapshot {
  readonly impressions?: number;
  readonly likes?: number;
  readonly comments?: number;
  readonly shares?: number;
  readonly clicks?: number;
}
