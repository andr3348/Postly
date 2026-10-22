/**
 * Tipos puros del OAuth de Meta (Facebook Login for Business).
 *
 * `MetaPageAsset` transporta el Page access token: solo vive en memoria del
 * backend y en el payload cifrado de `MetaOAuthSession` (TTL 10 minutos).
 * La UI recibe vistas sin `accessToken`.
 */
export type MetaOAuthSessionStatus = 'PENDING' | 'READY' | 'FAILED' | 'COMPLETED';

export interface MetaInstagramAsset {
  readonly id: string;
  readonly username: string;
}

export interface MetaPageAsset {
  readonly id: string;
  readonly name: string;
  readonly accessToken: string;
  readonly tasks: readonly string[];
  readonly instagram: MetaInstagramAsset | null;
}

export interface MetaTokenDebugInfo {
  readonly isValid: boolean;
  readonly expiresAt: Date | null;
  readonly scopes: readonly string[];
}

export interface MetaOAuthSession {
  readonly id: string;
  readonly brandId: string;
  readonly userId: string;
  readonly status: MetaOAuthSessionStatus;
  /** `null` hasta que el callback obtiene las páginas (o si falló). */
  readonly pages: readonly MetaPageAsset[] | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly completedAt: Date | null;
}
