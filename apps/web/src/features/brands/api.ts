import { apiJson } from '@/lib/api';

export interface Brand {
  readonly id: string;
  readonly name: string;
  readonly logoUrl: string | null;
  readonly websiteUrl: string | null;
  readonly aiTone: string;
  readonly aiBrandVoice: string | null;
  readonly aiTargetAudience: string | null;
  readonly defaultHashtags: string[];
}

export interface BrandPayload {
  readonly name: string;
  readonly logoUrl?: string | null;
  readonly websiteUrl?: string | null;
  readonly aiTone?: string;
  readonly aiBrandVoice?: string | null;
  readonly aiTargetAudience?: string | null;
  readonly defaultHashtags?: string[];
}

/**
 * Capa API del feature brands. Los componentes nunca hacen `fetch` crudo.
 */
export async function listBrands(): Promise<{ brands: Brand[] }> {
  return apiJson<{ brands: Brand[] }>('/brands');
}

/** Caché versionado para `use()` en componentes Suspense. */
let cache: { version: number; promise: Promise<{ brands: Brand[] }> } | null = null;

export function getBrandsCached(version: number): Promise<{ brands: Brand[] }> {
  if (cache === null || cache.version !== version) {
    cache = { version, promise: listBrands() };
  }
  return cache.promise;
}

/** Invalida el caché (tras crear/editar/eliminar). */
export function invalidateBrands(): void {
  cache = null;
}

export async function createBrand(payload: BrandPayload): Promise<{ brand: Brand }> {
  return apiJson<{ brand: Brand }>('/brands', {
    method: 'POST',
    data: payload,
  });
}

export async function updateBrand(id: string, payload: BrandPayload): Promise<{ brand: Brand }> {
  return apiJson<{ brand: Brand }>(`/brands/${id}`, {
    method: 'PATCH',
    data: payload,
  });
}

export async function deleteBrand(id: string): Promise<void> {
  await apiJson<unknown>(`/brands/${id}`, { method: 'DELETE' });
}
