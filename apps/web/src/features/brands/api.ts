import { apiJson } from '@/lib/api';

export interface Brand {
  readonly id: string;
  readonly name: string;
}

/**
 * Capa API del feature brands (lectura para el switcher; el CRUD completo
 * de marcas llega con su vista).
 */
export async function listBrands(): Promise<{ brands: Brand[] }> {
  return apiJson<{ brands: Brand[] }>('/brands');
}
