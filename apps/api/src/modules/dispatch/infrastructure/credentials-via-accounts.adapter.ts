import { Injectable } from '@nestjs/common';
import { GetCredentialsUseCase } from '../../connected-accounts/application/get-credentials.use-case.js';
import type { ConnectedAccountWithCredentials } from '../../connected-accounts/domain/connected-account.entity.js';
import type { TargetPlatform } from '../../publications/domain/target.entity.js';
import type { DispatchCredentials } from '../domain/ports/dispatch-credentials.port.js';

/** Adaptador: credenciales vía el módulo connected-accounts (descifradas). */
@Injectable()
export class CredentialsViaAccountsModule implements DispatchCredentials {
  constructor(private readonly credentials: GetCredentialsUseCase) {}

  async getForDispatch(
    brandId: string,
    platforms: TargetPlatform[],
  ): Promise<ConnectedAccountWithCredentials[]> {
    return this.credentials.execute(brandId, platforms);
  }
}
