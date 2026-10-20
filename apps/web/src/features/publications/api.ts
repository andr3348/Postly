import { apiJson } from "@/lib/api";
import type {
  PublicationMedia,
  PublicationPlatform,
  PublicationStatus,
} from "@/features/publications/schemas";

/**
 * Capa API del feature publications. Los componentes nunca hacen `fetch`
 * crudo. Las fechas llegan como ISO strings (JSON del backend).
 */
export interface Publication {
  readonly id: string;
  readonly brandId: string;
  readonly userId: string;
  readonly approvedById: string | null;
  readonly approvedAt: string | null;
  readonly originalPrompt: string;
  readonly systemPrompt: string | null;
  readonly modelText: string;
  readonly modelMedia: string | null;
  readonly tokensUsed: number | null;
  readonly copy: string;
  readonly mediaUrl: string;
  readonly mediaType: PublicationMedia;
  readonly status: PublicationStatus;
  readonly scheduledAt: string | null;
  readonly dispatchedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PublicationTarget {
  readonly id: string;
  readonly publicationId: string;
  readonly platform: PublicationPlatform;
  readonly status: "PENDING" | "SUCCESS" | "FAILED";
  readonly externalPostId: string | null;
  readonly externalPostUrl: string | null;
  readonly errorMessage: string | null;
  readonly publishedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface TargetMetric {
  readonly id: string;
  readonly publicationTargetId: string;
  readonly impressions: number;
  readonly likes: number;
  readonly comments: number;
  readonly shares: number;
  readonly clicks: number;
  readonly capturedAt: string;
}

export interface CreatePublicationPayload {
  readonly brandId: string;
  readonly originalPrompt?: string;
  readonly copy: string;
  readonly mediaUrl: string;
  readonly mediaType?: PublicationMedia;
}

export interface UpdateDraftPayload {
  readonly originalPrompt?: string;
  readonly copy?: string;
  readonly mediaUrl?: string;
  readonly mediaType?: PublicationMedia;
}

export interface RecordMetricPayload {
  readonly impressions?: number;
  readonly likes?: number;
  readonly comments?: number;
  readonly shares?: number;
  readonly clicks?: number;
}

/** El listado es arreglo desnudo (sin envoltorio), como en e2e. */
export async function listPublications(filters: {
  readonly brandId: string;
  readonly status?: PublicationStatus;
}): Promise<Publication[]> {
  return apiJson<Publication[]>("/publications", {
    params: {
      brandId: filters.brandId,
      ...(filters.status !== undefined ? { status: filters.status } : {}),
    },
  });
}

export async function getPublication(id: string): Promise<Publication> {
  return apiJson<Publication>(`/publications/${id}`);
}

export async function createPublication(
  payload: CreatePublicationPayload,
): Promise<Publication> {
  return apiJson<Publication>("/publications", { method: "POST", data: payload });
}

export async function updateDraft(
  id: string,
  payload: UpdateDraftPayload,
): Promise<Publication> {
  return apiJson<Publication>(`/publications/${id}`, {
    method: "PATCH",
    data: payload,
  });
}

export async function submitPublication(id: string): Promise<Publication> {
  return apiJson<Publication>(`/publications/${id}/submit`, { method: "POST" });
}

export async function approvePublication(
  id: string,
  scheduledAt: string,
): Promise<Publication> {
  return apiJson<Publication>(`/publications/${id}/approve`, {
    method: "POST",
    data: { scheduledAt },
  });
}

/** Aprueba con fecha actual y despierta a n8n (sin payload). */
export async function publishNow(id: string): Promise<Publication> {
  return apiJson<Publication>(`/publications/${id}/publish-now`, { method: "POST" });
}

export async function rejectPublication(id: string): Promise<Publication> {
  return apiJson<Publication>(`/publications/${id}/reject`, { method: "POST" });
}

export async function listTargets(id: string): Promise<PublicationTarget[]> {
  return apiJson<PublicationTarget[]>(`/publications/${id}/targets`);
}

export async function addTarget(
  id: string,
  platform: PublicationPlatform,
): Promise<PublicationTarget> {
  return apiJson<PublicationTarget>(`/publications/${id}/targets`, {
    method: "POST",
    data: { platform },
  });
}

export async function removeTarget(
  id: string,
  platform: PublicationPlatform,
): Promise<void> {
  await apiJson<unknown>(`/publications/${id}/targets/${platform}`, {
    method: "DELETE",
  });
}

export async function listTargetMetrics(
  id: string,
  platform: PublicationPlatform,
): Promise<TargetMetric[]> {
  return apiJson<TargetMetric[]>(`/publications/${id}/targets/${platform}/metrics`);
}

export async function recordMetric(
  id: string,
  platform: PublicationPlatform,
  snapshot: RecordMetricPayload,
): Promise<TargetMetric> {
  return apiJson<TargetMetric>(`/publications/${id}/targets/${platform}/metrics`, {
    method: "POST",
    data: snapshot,
  });
}

/** Cachés versionadas para `use()` en componentes Suspense. */
interface CachedRead<T> {
  readonly version: number;
  readonly promise: Promise<T>;
}

const listCache = new Map<string, CachedRead<Publication[]>>();
const publicationCache = new Map<string, CachedRead<Publication>>();
const targetsCache = new Map<string, CachedRead<PublicationTarget[]>>();
const metricsCache = new Map<string, CachedRead<TargetMetric[]>>();

/** Bandeja por marca + estado (estado vacío = todas). */
export function getPublicationsCached(
  brandId: string,
  status: PublicationStatus | null,
  version: number,
): Promise<Publication[]> {
  const key = `${brandId}|${status ?? ""}`;
  const hit = listCache.get(key);
  if (hit !== undefined && hit.version === version) {
    return hit.promise;
  }
  const promise = listPublications({
    brandId,
    ...(status !== null ? { status } : {}),
  });
  listCache.set(key, { version, promise });
  return promise;
}

export function getPublicationCached(
  id: string,
  version: number,
): Promise<Publication> {
  const hit = publicationCache.get(id);
  if (hit !== undefined && hit.version === version) {
    return hit.promise;
  }
  const promise = getPublication(id);
  publicationCache.set(id, { version, promise });
  return promise;
}

export function getTargetsCached(
  id: string,
  version: number,
): Promise<PublicationTarget[]> {
  const hit = targetsCache.get(id);
  if (hit !== undefined && hit.version === version) {
    return hit.promise;
  }
  const promise = listTargets(id);
  targetsCache.set(id, { version, promise });
  return promise;
}

export function getTargetMetricsCached(
  id: string,
  platform: PublicationPlatform,
  version: number,
): Promise<TargetMetric[]> {
  const key = `${id}|${platform}`;
  const hit = metricsCache.get(key);
  if (hit !== undefined && hit.version === version) {
    return hit.promise;
  }
  const promise = listTargetMetrics(id, platform);
  metricsCache.set(key, { version, promise });
  return promise;
}

/** Invalida toda la lectura del feature (tras cualquier mutación). */
export function invalidatePublications(): void {
  listCache.clear();
  publicationCache.clear();
  targetsCache.clear();
  metricsCache.clear();
}
