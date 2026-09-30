import type { MetricSnapshot, TargetMetric } from '../metric.entity.js';

/** Puerto de persistencia de snapshots de métricas (hoy: Prisma). */
export interface PublicationMetricsRepository {
  record(targetId: string, snapshot: MetricSnapshot): Promise<TargetMetric>;
  history(targetId: string): Promise<TargetMetric[]>;
}

export const PUBLICATION_METRICS_REPOSITORY: unique symbol = Symbol(
  'PublicationMetricsRepository',
);
