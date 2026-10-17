import { apiJson } from "@/lib/api";

/**
 * Capa API del feature analytics (solo lectura). Espeja el contrato real
 * `GET /analytics/summary?brandId=` del backend: sin `brandId` el agregado
 * cubre todas las marcas del usuario. Las formas son interfaces (no hay
 * formularios aquí; `schemas.ts` es solo para inputs de usuario).
 */
export interface PlatformSummary {
  readonly platform: string;
  readonly targets: number;
  readonly impressions: number;
  readonly interactions: number;
  /** Porcentaje 0–100 con 2 decimales (lo calcula el backend). */
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

export async function fetchAnalyticsSummary(
  brandId: string | null,
): Promise<AnalyticsSummary> {
  const query = brandId === null ? "" : `?brandId=${encodeURIComponent(brandId)}`;
  return apiJson<AnalyticsSummary>(`/analytics/summary${query}`);
}

/** Caché versionada para `use()` en Suspense (igual que publications). */
interface CachedRead<T> {
  readonly version: number;
  readonly promise: Promise<T>;
}

const summaryCache = new Map<string, CachedRead<AnalyticsSummary>>();

export function getAnalyticsSummaryCached(
  brandId: string | null,
  version: number,
): Promise<AnalyticsSummary> {
  const key = brandId ?? "";
  const hit = summaryCache.get(key);
  if (hit !== undefined && hit.version === version) {
    return hit.promise;
  }
  const promise = fetchAnalyticsSummary(brandId);
  summaryCache.set(key, { version, promise });
  return promise;
}

/**
 * El agregado deriva de publicaciones/targets/métricas: cualquier mutación
 * en el detalle de una publicación debe invalidarlo junto con su feature.
 */
export function invalidateAnalytics(): void {
  summaryCache.clear();
}
