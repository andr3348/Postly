import type { AccountPlatform } from '../connected-account.entity.js';

export const ACCOUNT_VERIFIER: unique symbol = Symbol('ACCOUNT_VERIFIER');

export interface VerifyAccountInput {
  readonly platform: AccountPlatform;
  readonly externalAccountId: string;
  readonly accessToken: string;
}

export interface VerifiedAccountInfo {
  /** Nombre mostrado devuelto por el proveedor (null si no lo expone). */
  readonly displayName: string | null;
}

export interface AccountVerifier {
  verify(input: VerifyAccountInput): Promise<VerifiedAccountInfo>;
}
