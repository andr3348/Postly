import type { ConnectedAccountWithCredentials } from '../../../connected-accounts/domain/connected-account.entity.js';
import type { TargetPlatform } from '../../../publications/domain/target.entity.js';

/**
 * Puerto de credenciales que el dispatch necesita. Lo implementa un
 * adaptador delegando en el módulo connected-accounts: dispatch nunca
 * toca su repositorio directamente.
 */
export interface DispatchCredentials {
  getForDispatch(
    brandId: string,
    platforms: TargetPlatform[],
  ): Promise<ConnectedAccountWithCredentials[]>;
}

export const DISPATCH_CREDENTIALS: unique symbol = Symbol('DispatchCredentials');
