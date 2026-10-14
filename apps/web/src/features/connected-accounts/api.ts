import { apiJson } from "@/lib/api";

export type AccountPlatform = "FACEBOOK" | "INSTAGRAM" | "LINKEDIN" | "TIKTOK";

export type AccountStatus = "CONNECTED" | "DISCONNECTED" | "EXPIRED";

export interface ConnectedAccount {
  readonly id: string;
  readonly brandId: string;
  readonly platform: AccountPlatform;
  readonly status: AccountStatus;
  readonly accountName: string;
  readonly externalAccountId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ConnectAccountPayload {
  readonly platform: AccountPlatform;
  readonly accountName: string;
  readonly externalAccountId: string;
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly expiresAt?: string;
  readonly scope?: string;
}

export interface VerifyAccountPayload {
  readonly platform: AccountPlatform;
  readonly externalAccountId: string;
  readonly accessToken: string;
}

export interface VerifyAccountResult {
  readonly valid: true;
  readonly displayName: string | null;
}

/**
 * Capa API del feature connected-accounts. Los componentes nunca hacen
 * `fetch` crudo. El backend responde la cuenta directa (sin envoltorio) y
 * el listado como arreglo directo.
 */
export async function listConnectedAccounts(brandId: string): Promise<ConnectedAccount[]> {
  return apiJson<ConnectedAccount[]>(`/brands/${brandId}/accounts`);
}

/** Caché versionado por marca para `use()` en componentes Suspense. */
const cache = new Map<string, { version: number; promise: Promise<ConnectedAccount[]> }>();

export function getAccountsCached(brandId: string, version: number): Promise<ConnectedAccount[]> {
  const hit = cache.get(brandId);
  if (hit === undefined || hit.version !== version) {
    const promise = listConnectedAccounts(brandId);
    cache.set(brandId, { version, promise });
    return promise;
  }
  return hit.promise;
}

/** Invalida el caché (tras conectar/desconectar). Sin marca = todo. */
export function invalidateAccounts(brandId?: string): void {
  if (brandId === undefined) {
    cache.clear();
    return;
  }
  cache.delete(brandId);
}

export async function connectAccount(
  brandId: string,
  payload: ConnectAccountPayload,
): Promise<ConnectedAccount> {
  return apiJson<ConnectedAccount>(`/brands/${brandId}/accounts`, {
    method: "POST",
    data: payload,
  });
}

/** Verifica contra la API real del proveedor sin persistir nada. */
export async function verifyAccount(
  brandId: string,
  payload: VerifyAccountPayload,
): Promise<VerifyAccountResult> {
  return apiJson<VerifyAccountResult>(`/brands/${brandId}/accounts/verify`, {
    method: "POST",
    data: payload,
  });
}

export async function disconnectAccount(brandId: string, platform: AccountPlatform): Promise<void> {
  await apiJson<unknown>(`/brands/${brandId}/accounts/${platform}`, {
    method: "DELETE",
  });
}
