import { apiJson } from "@/lib/api";

export type AccountPlatform = "FACEBOOK" | "INSTAGRAM" | "LINKEDIN" | "TIKTOK";

export type AccountStatus = "CONNECTED" | "DISCONNECTED" | "EXPIRED";

export type AccountAuthType = "MANUAL" | "META_OAUTH";

export interface ConnectedAccount {
  readonly id: string;
  readonly brandId: string;
  readonly platform: AccountPlatform;
  readonly status: AccountStatus;
  readonly authType: AccountAuthType;
  readonly metaPageId: string | null;
  readonly accountName: string;
  readonly externalAccountId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MetaInstagramInfo {
  readonly id: string;
  readonly username: string;
}

export interface MetaOAuthPageOption {
  readonly id: string;
  readonly name: string;
  readonly instagram: MetaInstagramInfo | null;
}

export interface MetaOAuthSession {
  readonly id: string;
  readonly status: "PENDING" | "READY" | "FAILED" | "COMPLETED";
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly pages: MetaOAuthPageOption[];
}

export interface MetaOAuthStartResult {
  readonly authorizationUrl: string;
}

export interface MetaOAuthCompleteResult {
  readonly account: ConnectedAccount;
  /** IG vinculado a la página elegida; se conecta luego con su propio botón. */
  readonly instagram: MetaInstagramInfo | null;
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

/**
 * OAuth de Meta. El navegador sale a facebook.com con `authorizationUrl`; el
 * callback vuelve al dashboard con una sesión temporal que se elige página.
 * Instagram no inicia OAuth propio: se conecta desde la Page ya guardada.
 */
export async function startMetaOAuth(brandId: string): Promise<MetaOAuthStartResult> {
  return apiJson<MetaOAuthStartResult>(`/brands/${brandId}/accounts/meta/oauth/start`);
}

export async function getMetaOAuthSession(
  brandId: string,
  sessionId: string,
): Promise<MetaOAuthSession> {
  return apiJson<MetaOAuthSession>(
    `/brands/${brandId}/accounts/meta/oauth/sessions/${sessionId}`,
  );
}

export async function completeMetaOAuth(
  brandId: string,
  sessionId: string,
  pageId: string,
): Promise<MetaOAuthCompleteResult> {
  return apiJson<MetaOAuthCompleteResult>(
    `/brands/${brandId}/accounts/meta/oauth/sessions/${sessionId}/complete`,
    { method: "POST", data: { pageId } },
  );
}

/** Usa el Page token guardado para detectar y guardar el IG vinculado. */
export async function connectInstagramFromFacebook(
  brandId: string,
): Promise<ConnectedAccount> {
  return apiJson<ConnectedAccount>(
    `/brands/${brandId}/accounts/instagram/from-facebook`,
    { method: "POST" },
  );
}
