import { apiJson } from '@/lib/api';
import {
  analyticsQuerySchema,
  type AnalyticsQuery,
  type AnalyticsSummary,
} from './schemas';

/**
 * Capa API del feature dashboard. Solo lectura para la pestaña Analytics;
 * los componentes nunca hacen `fetch` crudo ni conocen rutas.
 */
export async function getAnalyticsSummary(query: AnalyticsQuery = {}): Promise<AnalyticsSummary> {
  const params = new URLSearchParams();
  const parsed = analyticsQuerySchema.parse(query);
  if (parsed.brandId !== undefined) {
    params.set('brandId', parsed.brandId);
  }
  const suffix = params.size > 0 ? `?${params.toString()}` : '';
  return apiJson<AnalyticsSummary>(`/analytics/summary${suffix}`);
}
