import { useSyncExternalStore } from 'react';
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

/**
 * Caché de lectura para `use()` en componentes Suspense. Tras cualquier
 * mutación se invalida; `useBrandsVersion` re-sincroniza a los consumidores
 * persistentes (el switcher del navbar vive en el layout y no se remonta).
 */
let cache: Promise<{ brands: Brand[] }> | null = null;
let brandsVersion = 0;
const listeners = new Set<() => void>();

export function getBrandsCached(): Promise<{ brands: Brand[] }> {
  cache ??= listBrands();
  return cache;
}

/** Suscripción estable (React exige identidad constante para no re-suscribir). */
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getVersion(): number {
  return brandsVersion;
}

/** Versión global de la caché: cambia en cada invalidación. */
export function useBrandsVersion(): number {
  return useSyncExternalStore(subscribe, getVersion, getVersion);
}

/** Invalida el caché (tras crear/editar/eliminar) y re-sincroniza consumidores. */
export function invalidateBrands(): void {
  cache = null;
  brandsVersion += 1;
  for (const listener of listeners) listener();
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
