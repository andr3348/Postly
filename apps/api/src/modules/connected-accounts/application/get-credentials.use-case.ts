import { Inject, Injectable } from '@nestjs/common';
import { CONNECTED_ACCOUNTS_REPOSITORY, type ConnectedAccountsRepository } from '../domain/ports/connected-accounts.repository.js';
import type {
  AccountPlatform,
  ConnectedAccountWithCredentials,
} from '../domain/connected-account.entity.js';
import { MissingConnectedAccountError } from '../../../shared/errors.js';

/**
 * Punto de extensión para el despacho (n8n): devuelve credenciales
 * descifradas solo para las plataformas pedidas. Sin ruta pública hoy:
 * exponerlo exigiría auth servicio-a-servicio.
 */
@Injectable()
export class GetCredentialsUseCase {
  constructor(
    @Inject(CONNECTED_ACCOUNTS_REPOSITORY)
    private readonly accountsRepository: ConnectedAccountsRepository,
  ) {}

  async execute(
    brandId: string,
    platforms: AccountPlatform[],
  ): Promise<ConnectedAccountWithCredentials[]> {
    const credentials = await this.accountsRepository.getCredentialsForDispatch(
      brandId,
      platforms,
    );

    const foundPlatforms = new Set(credentials.map((credential) => credential.platform));
    const missingPlatforms = platforms.filter((platform) => !foundPlatforms.has(platform));

    if (missingPlatforms.length > 0) {
      throw new MissingConnectedAccountError(brandId, missingPlatforms);
    }

    return credentials;
  }
}
